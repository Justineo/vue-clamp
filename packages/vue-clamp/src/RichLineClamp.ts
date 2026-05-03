import { computed, defineComponent, h, mergeProps, nextTick, ref, watch } from "vue";
import { cssLength, normalizeLineLimit } from "./layout.ts";
import { useMultilineClamp } from "./multiline.ts";
import {
  blockAsProp,
  boundaryProp,
  ellipsisProp,
  expandedProp,
  maxHeightProp,
  maxLinesProp,
} from "./props.ts";
import { clampRich, patchRich, prepareRich } from "./rich.ts";
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties } from "vue";
import type { PreparedRich, RichState } from "./rich.ts";
import type { RichLineClampExposed, RichLineClampSlotProps } from "./types.ts";

const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

// Rich candidates are measured in an off-screen connected tree. Connected
// measurement preserves browser inline layout while keeping candidate churn out
// of the visible DOM.
const probeStyle: CSSProperties = {
  display: "block",
  left: "-99999px",
  pointerEvents: "none",
  position: "absolute",
  top: "0",
  visibility: "hidden",
};

type ProbeElements = {
  body: HTMLElement;
  content: HTMLElement;
};

// Large width jumps are cheaper as cold search than as repeated local expansion.
const warmSearchWidthDelta = 32;

const propsDef = {
  as: blockAsProp,
  html: {
    type: String,
    required: true,
  },
  maxLines: maxLinesProp,
  maxHeight: maxHeightProp,
  ellipsis: ellipsisProp,
  boundary: boundaryProp,
  expanded: expandedProp,
} as const;

const emitsDef = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function createProbe(): ProbeElements {
  const content = document.createElement("span");
  const body = document.createElement("span");

  return {
    body,
    content,
  };
}

export const RichLineClamp = defineComponent({
  name: "RichLineClamp",
  inheritAttrs: false,
  props: propsDef,
  emits: emitsDef,
  setup(props, { attrs, emit, expose, slots }) {
    const probeRef = ref<HTMLElement | null>(null);
    const isFallback = ref(false);

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const preparedHtml = computed(() => prepareRich(props.html, props.boundary));
    // The visible tree and hidden probe advance independently: visibleState
    // patches user-facing DOM, while probeState keeps measurement patches cheap
    // across repeated reclamps.
    let visibleState: RichState | null = null;
    let probeState: RichState | null = null;
    let probeElements: ProbeElements | null = null;
    let probeStateWidth: number | null = null;

    function resetStates(): void {
      visibleState = null;
      probeState = null;
      probeStateWidth = null;
    }

    function patchVisible(prepared: PreparedRich, state: RichState): void {
      const bodyElement = bodyRef.value;
      if (!bodyElement) {
        // If Vue has not mounted the target body, discard states rather than
        // applying future patches against an unknown DOM state.
        resetStates();
        return;
      }

      visibleState = patchRich(prepared, bodyElement, visibleState, state, props.ellipsis);
    }

    async function applyStatus(nextClamped: boolean, nextFallback: boolean): Promise<void> {
      const changed = isClamped.value !== nextClamped || isFallback.value !== nextFallback;

      isClamped.value = nextClamped;
      isFallback.value = nextFallback;

      if (changed) {
        // The measured rich DOM is already final; this tick exposes clamped
        // state changes after Vue commits the visible patch.
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
      const prepared = preparedHtml.value;

      if (prepared) {
        // Reset through the structural patcher so existing visible descendants
        // are restored consistently with normal clamp commits.
        patchVisible(prepared, { kind: "full" });
      } else {
        resetStates();
      }

      await applyStatus(false, false);
    }

    function prepareProbe(): {
      body: HTMLElement;
      content: HTMLElement;
      root: HTMLElement;
      width: number;
    } | null {
      const rootElement = rootRef.value;
      const probeRoot = probeRef.value;
      if (!rootElement || !probeRoot) {
        return null;
      }

      const elements = (probeElements ??= createProbe());
      const maxHeight = cssLength(props.maxHeight);
      const width = rootElement.getBoundingClientRect().width;

      probeRoot.style.width = `${width}px`;
      probeRoot.style.maxHeight = maxHeight === undefined ? "" : String(maxHeight);
      probeRoot.style.overflow = maxHeight === undefined ? "visible" : "hidden";

      elements.content.replaceChildren();

      const beforeElement = beforeRef.value;
      if (beforeElement) {
        // Slot content affects fit but should not be mutated by rich candidate
        // patches, so the probe receives cloned slot boxes.
        elements.content.appendChild(beforeElement.cloneNode(true));
      }

      elements.content.appendChild(elements.body);

      const afterElement = afterRef.value;
      if (afterElement) {
        elements.content.appendChild(afterElement.cloneNode(true));
      }

      probeRoot.replaceChildren(elements.content);

      return {
        body: elements.body,
        content: elements.content,
        root: probeRoot,
        width,
      };
    }

    const {
      rootRef,
      contentRef,
      beforeRef,
      bodyRef,
      afterRef,
      expanded,
      isClamped,
      expand,
      collapse,
      toggle,
      requestRecompute,
    } = useMultilineClamp({
      getExpanded: () => props.expanded,
      onExpandedChange: (value) => {
        emit("update:expanded", value);
      },
      onClampedChange: (value) => {
        emit("clampchange", value);
      },
      recompute: async (expanded): Promise<void> => {
        const { ellipsis, html: sourceHtml, maxHeight } = props;
        if (expanded.value || sourceHtml.length === 0 || !hasLimit.value) {
          // Expanded, empty, and unlimited states should leave the trusted HTML
          // visible as authored.
          await resetClamp();
          return;
        }

        const prepared = preparedHtml.value;

        if (!bodyRef.value || !prepared) {
          // DOMParser can be unavailable in non-browser environments, and refs
          // can be absent during mount/teardown; both cases use the safe source.
          await resetClamp();
          return;
        }

        const probe = prepareProbe();
        if (!probe) {
          await resetClamp();
          return;
        }

        const searchHint =
          probeStateWidth === null ||
          Math.abs(probe.width - probeStateWidth) <= warmSearchWidthDelta
            ? probeState
            : null;
        // Search hints help nearby resizes but can cost more on large jumps. The
        // current probe state is still passed separately so patching remains
        // correct even when the search starts cold.
        const result = clampRich({
          ellipsis,
          from: probeState,
          hint: searchHint,
          lineLimit: lineLimit.value,
          maxHeight,
          prepared,
          probe,
        });
        probeState = result.state;
        probeStateWidth = probe.width;

        if (!result.state) {
          // A zero-width probe should not replace visible content with a guessed
          // rich fragment.
          await resetClamp();
          return;
        }

        patchVisible(prepared, result.state);
        await applyStatus(result.state.kind === "clamped", result.fallback);
      },
    });

    watch(
      [
        () => props.html,
        () => props.maxLines,
        () => props.maxHeight,
        () => props.ellipsis,
        () => props.boundary,
      ],
      () => {
        // HTML and clamp semantics change the structural state space, so both
        // visible and probe patch cursors must restart.
        resetStates();
        isFallback.value = false;
        requestRecompute();
      },
      { flush: "post" },
    );

    expose({
      expand,
      collapse,
      toggle,
      get clamped() {
        return isClamped.value;
      },
      get expanded() {
        return expanded.value;
      },
    } satisfies RichLineClampExposed);

    return () => {
      const { as: rootTag, html: sourceHtml, maxHeight } = props;
      const collapsedMaxHeight =
        !expanded.value && !isFallback.value ? cssLength(maxHeight) : undefined;

      const slotProps: RichLineClampSlotProps = {
        expand,
        collapse,
        toggle,
        clamped: isClamped.value,
        expanded: expanded.value,
      };
      const beforeSlot = slots.before?.(slotProps);
      const afterSlot = slots.after?.(slotProps);
      const hasBeforeSlot = hasSlotContent(beforeSlot);
      const hasAfterSlot = hasSlotContent(afterSlot);

      return h(
        rootTag,
        mergeProps(attrs, {
          "data-part": "root",
          ref: rootRef,
          style: {
            maxHeight: collapsedMaxHeight,
            overflow: collapsedMaxHeight ? "hidden" : undefined,
          },
        }),
        [
          h(
            "span",
            {
              "data-part": "content",
              ref: contentRef,
            },
            [
              hasBeforeSlot
                ? h(
                    "span",
                    {
                      "data-part": "before",
                      ref: beforeRef,
                      style: slotStyle,
                    },
                    beforeSlot,
                  )
                : null,
              h("span", {
                "data-part": "body",
                ref: bodyRef,
                innerHTML: sourceHtml,
              }),
              hasAfterSlot
                ? h(
                    "span",
                    {
                      "data-part": "after",
                      ref: afterRef,
                      style: slotStyle,
                    },
                    afterSlot,
                  )
                : null,
            ],
          ),
          h("span", {
            "aria-hidden": "true",
            ref: probeRef,
            style: probeStyle,
          }),
        ],
      );
    };
  },
});
