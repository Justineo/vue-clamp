import { computed, defineComponent, h, mergeProps, nextTick, ref, watch } from "vue";
import { cssLength, normalizeLineLimit } from "./layout.ts";
import { useMultilineClamp } from "./multiline.ts";
import { hasSlotContent } from "./slot.ts";
import {
  canUseNativeClamp,
  clampTextToLayout,
  isNativeClamped,
  normalizeLocationRatio,
  prepareText,
} from "./text.ts";

import type { CSSProperties, PropType, VNodeChild } from "vue";
import type { LineClampExposed, LineClampLocation, LineClampSlotProps } from "./types.ts";

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
  as: {
    type: String,
    default: "div",
  },
  text: {
    type: String,
    default: "",
  },
  maxLines: Number,
  maxHeight: [Number, String] as PropType<number | string | undefined>,
  ellipsis: {
    type: String,
    default: "…",
  },
  location: {
    type: [String, Number] as PropType<LineClampLocation>,
    default: "end",
    validator(value: unknown) {
      return (
        value === "start" ||
        value === "middle" ||
        value === "end" ||
        (typeof value === "number" && Number.isFinite(value))
      );
    },
  },
  expanded: {
    type: Boolean,
    default: false,
  },
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

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const locationRatio = computed(() => normalizeLocationRatio(props.location));
    const preparedText = computed(() => prepareText(props.text));
    const nativeOverflowMode = computed(() =>
      canUseNativeClamp(
        expanded.value,
        lineLimit.value,
        props.maxHeight,
        locationRatio.value,
        props.ellipsis,
      ),
    );

    async function applyTextState(nextText: string, nextClamped: boolean): Promise<void> {
      const changed = visibleText.value !== nextText || isClamped.value !== nextClamped;

      visibleText.value = nextText;
      isClamped.value = nextClamped;

      if (changed) {
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
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
          await resetClamp();
          return;
        }

        const rootElement = rootRef.value;
        const contentElement = contentRef.value;
        const textElement = textRef.value;

        if (!rootElement || !contentElement || !textElement) {
          await resetClamp();
          return;
        }

        if (nativeOverflowMode.value) {
          const nextClamped = isNativeClamped(textElement);
          await applyTextState(sourceText, nextClamped ?? false);
          return;
        }

        const nextText = clampTextToLayout(
          preparedText.value,
          rootElement,
          contentElement,
          textElement,
          locationRatio.value,
          ellipsis,
          lineLimit.value,
          maxHeight,
        );

        if (nextText === null) {
          await resetClamp();
          return;
        }

        await applyTextState(nextText, nextText !== preparedText.value.text);
      },
    });

    watch(
      [
        () => props.text,
        () => props.maxLines,
        () => props.maxHeight,
        () => props.ellipsis,
        () => props.location,
      ],
      () => {
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
