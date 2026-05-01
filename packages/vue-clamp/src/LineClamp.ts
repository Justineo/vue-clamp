import { computed, defineComponent, h, mergeProps, nextTick, ref, watch } from "vue";
import { cssLength, normalizeLineLimit } from "./layout.ts";
import { useMultilineClamp } from "./multiline.ts";
import {
  blockAsProp,
  boundaryProp,
  ellipsisProp,
  expandedProp,
  locationProp,
  maxHeightProp,
  maxLinesProp,
} from "./props.ts";
import { hasSlotContent } from "./slot.ts";
import {
  canUseNativeClamp,
  clampTextToLayout,
  isNativeClamped,
  normalizeLocationRatio,
  prepareText,
} from "./text.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { LineClampExposed, LineClampSlotProps } from "./types.ts";
import type { TextClampResult } from "./text.ts";

// Slot wrappers are inline-flex so before/after controls participate in the same
// line box as text while staying atomic during measurement.
const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

const nativeContentStyle: CSSProperties = {
  alignItems: "baseline",
  display: "inline-flex",
  maxWidth: "100%",
  verticalAlign: "baseline",
  width: "100%",
};

// The native path is intentionally narrow: it is only used when browser
// text-overflow semantics exactly match the public props.
const nativeTextStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  overflowWrap: "normal",
  whiteSpace: "nowrap",
};

const nativeTextContainerStyle: CSSProperties = {
  display: "block",
  flex: "1 1 auto",
  minWidth: "0",
};

const nativeSlotStyle: CSSProperties = {
  ...slotStyle,
  flex: "none",
};

const visuallyHiddenTextStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  clipPath: "inset(50%)",
};

const propsDef = {
  as: blockAsProp,
  text: {
    type: String,
    default: "",
  },
  maxLines: maxLinesProp,
  maxHeight: maxHeightProp,
  ellipsis: ellipsisProp,
  location: locationProp,
  boundary: boundaryProp,
  expanded: expandedProp,
} as const;

const emitsDef = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

export const LineClamp = defineComponent({
  name: "LineClamp",
  inheritAttrs: false,
  props: propsDef,
  emits: emitsDef,
  setup(props, { attrs, emit, expose, slots }) {
    const textRef = ref<HTMLElement | null>(null);
    const visibleText = ref(props.text);
    let lastTextClamp: TextClampResult | null = null;

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const locationRatio = computed(() => normalizeLocationRatio(props.location));
    const preparedText = computed(() => prepareText(props.text, props.boundary));
    const nativeOverflowMode = computed(() =>
      canUseNativeClamp(
        expanded.value,
        lineLimit.value,
        props.maxHeight,
        locationRatio.value,
        props.ellipsis,
        props.boundary,
      ),
    );

    async function applyTextState(nextText: string, nextClamped: boolean): Promise<void> {
      const changed = visibleText.value !== nextText || isClamped.value !== nextClamped;

      visibleText.value = nextText;
      isClamped.value = nextClamped;

      if (changed) {
        // DOM measurement has already completed synchronously; this tick only
        // lets Vue commit the final visible state before callers observe it.
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
      lastTextClamp = null;
      return applyTextState(props.text, false);
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
        const { ellipsis, maxHeight, text: sourceText } = props;
        if (expanded.value || sourceText.length === 0 || !hasLimit.value) {
          // Expanded, empty, and unlimited states should expose the source text
          // directly so the DOM stays simple when no truncation is needed.
          await resetClamp();
          return;
        }

        const rootElement = rootRef.value;
        const contentElement = contentRef.value;
        const textElement = textRef.value;

        if (!rootElement || !contentElement || !textElement) {
          // Missing refs are a mount/teardown timing state; avoid caching a
          // partial measurement result.
          await resetClamp();
          return;
        }

        if (nativeOverflowMode.value) {
          // Browser text-overflow is cheaper and more faithful for the one case
          // where it supports every requested behavior.
          lastTextClamp = null;
          const nextClamped = isNativeClamped(textElement);
          await applyTextState(sourceText, nextClamped ?? false);
          return;
        }

        const prepared = preparedText.value;
        const ratio = locationRatio.value;
        const nextResult = clampTextToLayout(
          prepared,
          rootElement,
          contentElement,
          textElement,
          ratio,
          ellipsis,
          lineLimit.value,
          maxHeight,
          lastTextClamp,
        );

        if (nextResult === null) {
          // A zero-width root cannot produce a stable clamp; keep source text
          // until layout becomes measurable.
          await resetClamp();
          return;
        }

        lastTextClamp = nextResult;
        await applyTextState(nextResult.text, nextResult.text !== prepared.text);
      },
    });

    watch(
      [
        () => props.text,
        () => props.maxLines,
        () => props.maxHeight,
        () => props.ellipsis,
        () => props.location,
        () => props.boundary,
      ],
      () => {
        // Any semantic prop change invalidates the previous kept-count hint.
        lastTextClamp = null;
        visibleText.value = props.text;
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
    } satisfies LineClampExposed);

    return () => {
      const { as: rootTag, maxHeight, text: sourceText } = props;
      const collapsedMaxHeight = !expanded.value ? cssLength(maxHeight) : undefined;

      const slotProps: LineClampSlotProps = {
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
      const nativeOverflow = nativeOverflowMode.value;
      const needsAccessibleSourceText =
        !nativeOverflow && visibleText.value !== sourceText && hasLimit.value && !expanded.value;
      // When JS rewrites visible text, keep the full source in the accessibility
      // tree while hiding only the visual replacement from assistive tech.
      const bodyStyle = nativeOverflow ? nativeTextContainerStyle : { position: "relative" };
      const shouldRenderFullText =
        nativeOverflow || expanded.value || visibleText.value.length === 0 || !hasLimit.value;
      const renderedText = shouldRenderFullText ? sourceText : visibleText.value;
      const bodyChildren: VNodeChild[] = [
        needsAccessibleSourceText
          ? h(
              "span",
              {
                style: visuallyHiddenTextStyle,
              },
              sourceText,
            )
          : null,
        h(
          "span",
          {
            key: "text",
            ref: textRef,
            "aria-hidden": needsAccessibleSourceText ? "true" : undefined,
            style: nativeOverflow
              ? {
                  ...nativeTextStyle,
                  textOverflow: nativeOverflow,
                }
              : undefined,
          },
          renderedText,
        ),
      ];

      return h(
        rootTag,
        mergeProps(attrs, {
          "data-part": "root",
          ref: rootRef,
          style: {
            maxHeight: collapsedMaxHeight,
            overflow: "hidden",
          },
        }),
        h(
          "span",
          {
            "data-part": "content",
            ref: contentRef,
            style: nativeOverflow ? nativeContentStyle : undefined,
          },
          [
            hasBeforeSlot
              ? h(
                  "span",
                  {
                    "data-part": "before",
                    ref: beforeRef,
                    style: nativeOverflow ? nativeSlotStyle : slotStyle,
                  },
                  beforeSlot,
                )
              : null,
            h(
              "span",
              {
                "data-part": "body",
                ref: bodyRef,
                style: bodyStyle,
              },
              bodyChildren,
            ),
            hasAfterSlot
              ? h(
                  "span",
                  {
                    "data-part": "after",
                    ref: afterRef,
                    style: nativeOverflow ? nativeSlotStyle : slotStyle,
                  },
                  afterSlot,
                )
              : null,
          ],
        ),
      );
    };
  },
});
