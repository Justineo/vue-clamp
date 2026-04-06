import {
  computed,
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchPostEffect,
} from "vue";
import { hasSlotContent } from "./slot.ts";
import { displayTextForKeptCount, prepareText } from "./text.ts";

import type { CSSProperties, PropType } from "vue";
import type { LineClampExposed, LineClampLocation, LineClampSlotProps } from "./types.ts";
import type { PreparedText } from "./text.ts";

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

const clampEmits = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function normalizeLineLimit(maxLines: number | undefined): number | undefined {
  return maxLines === undefined || !Number.isFinite(maxLines) || maxLines <= 0
    ? undefined
    : Math.max(1, Math.floor(maxLines));
}

function normalizeLocationRatio(location: LineClampLocation): number {
  if (location === "start") {
    return 0;
  }

  if (location === "middle") {
    return 0.5;
  }

  if (location === "end") {
    return 1;
  }

  return Math.max(0, Math.min(1, location));
}

function canUseNativeClamp(
  expanded: boolean,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
  locationRatio: number,
  ellipsis: string,
): string | null {
  if (expanded || lineLimit !== 1 || maxHeight !== undefined || locationRatio !== 1) {
    return null;
  }

  return ellipsis === "…" ? "ellipsis" : null;
}

function isNativeClamped(textElement: HTMLElement): boolean | null {
  if (textElement.clientWidth <= 0 || textElement.getBoundingClientRect().width <= 0) {
    return null;
  }

  return textElement.scrollWidth > textElement.clientWidth + 0.5;
}

function clampText(
  preparedText: PreparedText,
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  textElement: HTMLElement,
  locationRatio: number,
  ellipsis: string,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
): string | null {
  if (rootElement.getBoundingClientRect().width <= 0) {
    return null;
  }

  const graphemeCount = preparedText.boundaryOffsets.length - 1;
  let currentText = textElement.textContent ?? "";

  function applyKept(kept: number): string {
    const nextText = displayTextForKeptCount(preparedText, locationRatio, ellipsis, kept);

    if (nextText !== currentText) {
      textElement.textContent = nextText;
      currentText = nextText;
    }

    return nextText;
  }

  function fits(): boolean {
    const rects = Array.from(contentElement.getClientRects()).filter((rect) => rect.height > 0);

    if (maxHeight !== undefined) {
      if (rects.length > 0) {
        const currentRootRect = rootElement.getBoundingClientRect();
        const visibleTop = currentRootRect.top + rootElement.clientTop;
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

      for (const rect of rects) {
        lines.add(`${rect.top}/${rect.bottom}`);
      }

      if (lines.size > lineLimit) {
        return false;
      }
    }

    return true;
  }

  function search(low: number, high: number, best: number): number {
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

    return best;
  }

  if (applyKept(graphemeCount) === preparedText.text && fits()) {
    return preparedText.text;
  }

  const best = search(0, graphemeCount - 1, 0);
  return applyKept(best);
}

export const LineClamp = defineComponent({
  name: "LineClamp",
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

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const locationRatio = computed(() => normalizeLocationRatio(props.location));
    const preparedText = computed(() => prepareText(props.text));
    const nativeTextOverflow = computed(() =>
      canUseNativeClamp(
        expanded.value,
        lineLimit.value,
        props.maxHeight,
        locationRatio.value,
        props.ellipsis,
      ),
    );

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

    function commitClamp(nextText: string, nextClamped: boolean): void {
      if (visibleText.value !== nextText) {
        visibleText.value = nextText;
      }

      if (isClamped.value !== nextClamped) {
        isClamped.value = nextClamped;
      }
    }

    function resetClamp(): void {
      commitClamp(props.text, false);
    }

    function recompute(): void {
      if (expanded.value || props.text.length === 0 || !hasLimit.value) {
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

      if (nativeTextOverflow.value) {
        const nextClamped = isNativeClamped(textElement);
        commitClamp(props.text, nextClamped ?? false);
        return;
      }

      const source = preparedText.value;
      const nextText = clampText(
        source,
        rootElement,
        contentElement,
        textElement,
        locationRatio.value,
        props.ellipsis,
        lineLimit.value,
        props.maxHeight,
      );

      if (nextText === null) {
        resetClamp();
        return;
      }

      commitClamp(nextText, nextText !== source.text);
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
      resizeObserver ??= new ResizeObserver(() => {
        recompute();
      });

      const observed: Element[] = [];
      if (rootRef.value) {
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
      fontFaceSet.addEventListener("loadingdone", handleFontLoad);
      stopFonts = () => {
        fontFaceSet.removeEventListener("loadingdone", handleFontLoad);
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
    } satisfies LineClampExposed);

    return () => {
      let collapsedMaxHeight: string | number | undefined;

      if (!expanded.value && props.maxHeight !== undefined) {
        collapsedMaxHeight =
          typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight;
      }

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
      const nativeOverflow = nativeTextOverflow.value;
      const renderedText =
        nativeOverflow || expanded.value || visibleText.value.length === 0 || !hasLimit.value
          ? props.text
          : visibleText.value;

      const needsAccessibleSourceText = renderedText !== props.text;

      return h(
        props.as,
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
                style: nativeOverflow ? nativeTextContainerStyle : { position: "relative" },
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
                    style: nativeOverflow
                      ? {
                          ...nativeTextStyle,
                          textOverflow: nativeOverflow,
                        }
                      : undefined,
                  },
                  renderedText,
                ),
              ],
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
