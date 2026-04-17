import { computed, defineComponent, h, mergeProps, nextTick, ref, watch } from "vue";
import { cssLength, normalizeLineLimit } from "./layout.ts";
import { useMultilineClamp } from "./multiline.ts";
import { blockAsProp, ellipsisProp, expandedProp, maxHeightProp, maxLinesProp } from "./props.ts";
import { clampRichTextToLayout, patchRichTextToDecision, prepareRichText } from "./rich.ts";
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties } from "vue";
import type { PreparedRichText, RichClampDecision } from "./rich.ts";
import type { RichLineClampExposed, RichLineClampSlotProps } from "./types.ts";

const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};
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

const propsDef = {
  as: blockAsProp,
  html: {
    type: String,
    required: true,
  },
  maxLines: maxLinesProp,
  maxHeight: maxHeightProp,
  ellipsis: ellipsisProp,
  expanded: expandedProp,
} as const;

const emitsDef = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function createProbeElements(): ProbeElements {
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
    const preparedHtml = computed(() => prepareRichText(props.html));
    let visibleDecision: RichClampDecision | null = null;
    let probeDecision: RichClampDecision | null = null;
    let probeElements: ProbeElements | null = null;

    function resetDecisions(): void {
      visibleDecision = null;
      probeDecision = null;
    }

    function patchVisible(prepared: PreparedRichText, decision: RichClampDecision): void {
      const bodyElement = bodyRef.value;
      if (!bodyElement) {
        resetDecisions();
        return;
      }

      visibleDecision = patchRichTextToDecision(
        prepared,
        bodyElement,
        visibleDecision,
        decision,
        props.ellipsis,
      );
    }

    async function applyState(nextClamped: boolean, nextFallback: boolean): Promise<void> {
      const changed = isClamped.value !== nextClamped || isFallback.value !== nextFallback;

      isClamped.value = nextClamped;
      isFallback.value = nextFallback;

      if (changed) {
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
      const prepared = preparedHtml.value;

      if (prepared) {
        patchVisible(prepared, { kind: "full" });
      } else {
        resetDecisions();
      }

      await applyState(false, false);
    }

    function prepareProbe(): {
      body: HTMLElement;
      content: HTMLElement;
      root: HTMLElement;
    } | null {
      const rootElement = rootRef.value;
      const probeRoot = probeRef.value;
      if (!rootElement || !probeRoot) {
        return null;
      }

      const elements = (probeElements ??= createProbeElements());
      const maxHeight = cssLength(props.maxHeight);

      probeRoot.style.width = `${rootElement.getBoundingClientRect().width}px`;
      probeRoot.style.maxHeight = maxHeight === undefined ? "" : String(maxHeight);
      probeRoot.style.overflow = maxHeight === undefined ? "visible" : "hidden";

      elements.content.replaceChildren();

      const beforeElement = beforeRef.value;
      if (beforeElement) {
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
      recompute: async ({ expanded }): Promise<void> => {
        const { ellipsis, html: sourceHtml, maxHeight } = props;
        if (expanded.value || sourceHtml.length === 0 || !hasLimit.value) {
          await resetClamp();
          return;
        }

        const prepared = preparedHtml.value;

        if (!bodyRef.value || !prepared) {
          await resetClamp();
          return;
        }

        const probe = prepareProbe();
        if (!probe) {
          await resetClamp();
          return;
        }

        const nextState = clampRichTextToLayout(
          prepared,
          probe.root,
          probe.content,
          probe.body,
          probeDecision,
          ellipsis,
          lineLimit.value,
          maxHeight,
        );
        probeDecision = nextState.decision;

        if (!nextState.decision) {
          await resetClamp();
          return;
        }

        patchVisible(prepared, nextState.decision);
        await applyState(nextState.decision.kind === "clamped", nextState.fallback);
      },
    });

    watch(
      [() => props.html, () => props.maxLines, () => props.maxHeight, () => props.ellipsis],
      () => {
        resetDecisions();
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
