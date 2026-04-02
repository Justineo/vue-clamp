import {
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchPostEffect,
} from "vue";
import { displayTextForKeptCount, splitGraphemes } from "./text.ts";

import type { CSSProperties, PropType } from "vue";
import type { ClampExposed, ClampLocation, ClampSlotProps } from "./types.ts";

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

const clampProps = {
  as: {
    type: String,
    default: "div",
  },
  autoresize: {
    type: Boolean,
    default: false,
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
    type: String as PropType<ClampLocation>,
    default: "end",
    validator(value: string) {
      return value === "start" || value === "middle" || value === "end";
    },
  },
  expanded: {
    type: Boolean,
    default: false,
  },
} as const;

const clampEmits = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function normalizeLineLimit(maxLines: number | undefined): number | undefined {
  return maxLines === undefined || !Number.isFinite(maxLines) || maxLines <= 0
    ? undefined
    : Math.max(1, Math.floor(maxLines));
}

function nativeTextOverflowValue(ellipsis: string): string | null {
  return ellipsis === "…" ? "ellipsis" : null;
}

function canUseNativeClamp(
  expanded: boolean,
  maxLines: number | undefined,
  maxHeight: number | string | undefined,
  location: ClampLocation,
  ellipsis: string,
): string | null {
  if (
    expanded ||
    normalizeLineLimit(maxLines) !== 1 ||
    maxHeight !== undefined ||
    location !== "end"
  ) {
    return null;
  }

  return nativeTextOverflowValue(ellipsis);
}

function isNativeClamped(textElement: HTMLElement): boolean | null {
  if (textElement.clientWidth <= 0 || textElement.getBoundingClientRect().width <= 0) {
    return null;
  }

  return textElement.scrollWidth > textElement.clientWidth + 0.5;
}

function clampText(
  text: string,
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  textElement: HTMLElement,
  location: ClampLocation,
  ellipsis: string,
  maxLines: number | undefined,
  maxHeight: number | string | undefined,
): string | null {
  const style = getComputedStyle(rootElement);

  function readPx(value: string | null | undefined): number | undefined {
    if (!value || value === "none" || value === "normal") {
      return undefined;
    }

    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  const padding = (readPx(style.paddingLeft) ?? 0) + (readPx(style.paddingRight) ?? 0);
  const border = (readPx(style.borderLeftWidth) ?? 0) + (readPx(style.borderRightWidth) ?? 0);
  const styledWidth = readPx(style.width);
  const widthAdjustment = style.boxSizing === "border-box" ? padding + border : 0;
  const width =
    styledWidth !== undefined
      ? Math.max(0, styledWidth - widthAdjustment)
      : Math.max(0, rootElement.getBoundingClientRect().width - padding - border);

  if (width <= 0) {
    return null;
  }

  const lineLimit = normalizeLineLimit(maxLines);
  const graphemes = splitGraphemes(text);
  let currentText = textElement.textContent ?? "";

  function applyKept(kept: number): string {
    const nextText = displayTextForKeptCount(text, graphemes, location, ellipsis, kept);

    if (nextText !== currentText) {
      textElement.textContent = nextText;
      currentText = nextText;
    }

    return nextText;
  }

  function fits(): boolean {
    if (maxHeight !== undefined) {
      const rects = Array.from(contentElement.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );

      if (rects.length > 0) {
        const rootRect = rootElement.getBoundingClientRect();
        const visibleTop = rootRect.top + rootElement.clientTop;
        const visibleBottom = visibleTop + rootElement.clientHeight;

        if (
          rects.some((rect) => rect.top < visibleTop - 0.5 || rect.bottom > visibleBottom + 0.5)
        ) {
          return false;
        }
      }
    }

    if (lineLimit !== undefined) {
      const lines = new Set<string>();

      for (const rect of Array.from(contentElement.getClientRects())) {
        lines.add(`${rect.top}/${rect.bottom}`);
      }

      if (lines.size > lineLimit) {
        return false;
      }
    }

    return true;
  }

  if (applyKept(graphemes.length) === text && fits()) {
    return text;
  }

  let low = 0;
  let high = graphemes.length - 1;
  let best = 0;

  while (low <= high) {
    const kept = Math.floor((low + high) / 2);

    applyKept(kept);

    if (fits()) {
      best = kept;
      low = kept + 1;
    } else {
      high = kept - 1;
    }
  }

  return applyKept(best);
}

export const Clamp = defineComponent({
  name: "vue-clamp",
  inheritAttrs: false,
  props: clampProps,
  emits: clampEmits,
  setup(props, { attrs, emit, expose, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const beforeRef = ref<HTMLElement | null>(null);
    const textRef = ref<HTMLElement | null>(null);
    const afterRef = ref<HTMLElement | null>(null);
    const visibleText = ref("");
    const expanded = ref(props.expanded);
    const isClamped = ref(false);
    const nativeTextOverflow = ref<string | null>(null);

    let resizeObserver: ResizeObserver | null = null;
    let stopFonts = () => {};

    function expand(): void {
      expanded.value = true;
    }

    function collapse(): void {
      expanded.value = false;
    }

    function toggle(): void {
      expanded.value = !expanded.value;
    }

    function resetClamp(): void {
      visibleText.value = props.text;
      isClamped.value = false;
    }

    function recompute(): void {
      const hasLimit = props.maxLines !== undefined || props.maxHeight !== undefined;
      const nextNativeTextOverflow = canUseNativeClamp(
        expanded.value,
        props.maxLines,
        props.maxHeight,
        props.location,
        props.ellipsis,
      );
      nativeTextOverflow.value = nextNativeTextOverflow;

      if (expanded.value || props.text.length === 0 || !hasLimit) {
        resetClamp();
        return;
      }

      const rootElement = rootRef.value;
      const contentElement = contentRef.value;
      const textElement = textRef.value;

      if (!rootElement || !contentElement || !textElement) {
        resetClamp();
        return;
      }

      if (nextNativeTextOverflow) {
        visibleText.value = props.text;

        const nextClamped = isNativeClamped(textElement);
        isClamped.value = nextClamped ?? false;
        return;
      }

      const nextText = clampText(
        props.text,
        rootElement,
        contentElement,
        textElement,
        props.location,
        props.ellipsis,
        props.maxLines,
        props.maxHeight,
      );

      if (nextText === null) {
        resetClamp();
        return;
      }

      visibleText.value = nextText;
      isClamped.value = nextText !== props.text;
    }

    watch(
      () => props.expanded,
      (value) => {
        expanded.value = value;
      },
    );

    watch(
      expanded,
      (value) => {
        if (props.expanded !== value) {
          emit("update:expanded", value);
        }

        recompute();
      },
      { flush: "post" },
    );

    watch(
      [
        () => props.text,
        () => props.maxLines,
        () => props.maxHeight,
        () => props.ellipsis,
        () => props.location,
      ],
      recompute,
      { flush: "post" },
    );

    watch(
      isClamped,
      (value) => {
        emit("clampchange", value);
      },
      { flush: "post", immediate: true },
    );

    watchPostEffect((onCleanup) => {
      if (typeof ResizeObserver === "undefined") {
        return;
      }

      resizeObserver ??= new ResizeObserver(() => {
        recompute();
      });

      const observed: Element[] = [];
      if (props.autoresize && rootRef.value) {
        observed.push(rootRef.value);
      }
      if (beforeRef.value) {
        observed.push(beforeRef.value);
      }
      if (afterRef.value) {
        observed.push(afterRef.value);
      }

      for (const element of observed) {
        resizeObserver.observe(element);
      }

      onCleanup(() => {
        for (const element of observed) {
          resizeObserver?.unobserve(element);
        }
      });
    });

    onMounted(() => {
      recompute();

      const fontFaceSet = document.fonts;
      if (!fontFaceSet) {
        return;
      }

      function handleFontLoad(): void {
        recompute();
      }

      void fontFaceSet.ready.then(handleFontLoad);
      fontFaceSet.addEventListener?.("loadingdone", handleFontLoad);
      stopFonts = () => {
        fontFaceSet.removeEventListener?.("loadingdone", handleFontLoad);
      };
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      stopFonts();
    });

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
    } satisfies ClampExposed);

    return () => {
      const hasLimit = props.maxLines !== undefined || props.maxHeight !== undefined;
      let collapsedMaxHeight: string | number | undefined;

      if (!expanded.value && props.maxHeight !== undefined) {
        collapsedMaxHeight =
          typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight;
      }

      const slotProps: ClampSlotProps = {
        expand,
        collapse,
        toggle,
        clamped: isClamped.value,
        expanded: expanded.value,
      };
      const beforeSlot = slots.before?.(slotProps);
      const afterSlot = slots.after?.(slotProps);
      const renderedText =
        nativeTextOverflow.value || expanded.value || visibleText.value.length === 0 || !hasLimit
          ? props.text
          : visibleText.value;

      const needsAccessibleSourceText = renderedText !== props.text;

      return h(
        props.as,
        mergeProps(attrs, {
          ref: rootRef,
          style: {
            maxHeight: collapsedMaxHeight,
            overflow: "hidden",
          },
        }),
        h(
          "span",
          {
            ref: contentRef,
            style: nativeTextOverflow.value ? nativeContentStyle : undefined,
          },
          [
            beforeSlot
              ? h(
                  "span",
                  {
                    ref: beforeRef,
                    style: nativeTextOverflow.value ? nativeSlotStyle : slotStyle,
                  },
                  beforeSlot,
                )
              : null,
            h(
              "span",
              {
                style: nativeTextOverflow.value
                  ? nativeTextContainerStyle
                  : { position: "relative" },
              },
              [
                needsAccessibleSourceText
                  ? h(
                      "span",
                      {
                        style: visuallyHiddenTextStyle,
                      },
                      props.text,
                    )
                  : null,
                h(
                  "span",
                  {
                    ref: textRef,
                    "aria-hidden": needsAccessibleSourceText ? "true" : undefined,
                    style: nativeTextOverflow.value
                      ? {
                          ...nativeTextStyle,
                          textOverflow: nativeTextOverflow.value,
                        }
                      : undefined,
                  },
                  renderedText,
                ),
              ],
            ),
            afterSlot
              ? h(
                  "span",
                  {
                    ref: afterRef,
                    style: nativeTextOverflow.value ? nativeSlotStyle : slotStyle,
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
