<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch } from "vue";
import { trueOrUndefined } from "../attributes.ts";
import {
  borderBoxWidth,
  cssLength,
  estimateLineCapacity,
  hasBorderBoxSize,
  hasInlineFontMetrics,
  hasInlineLineMetrics,
  hasUnresolvedInlineTextWidthStyle,
  normalizeLineLimit,
  simpleLineFitFromStyle,
} from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { renderMultilineAffixSlot } from "../multiline-render.ts";
import { multilineNativeSlotStyle, multilineSlotStyle } from "../multiline-styles.ts";
import {
  getNativeContentStyle,
  measureNativeClamped,
  nativeBodyStyle,
  nativeTextStyle,
  resolveNativeMode,
} from "../native.ts";
import {
  predictivePendingStyle,
  predictiveRootStyle,
  predictiveWidthStyle,
  visuallyHiddenTextStyle,
} from "../styles.ts";
import { clampTextToLayout, normalizeLocationRatio, prepareText, setElementText } from "../text.ts";
import { useLineClampPredictor } from "./predictor.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { BorderBoxSizeSnapshot, SimpleLineFit } from "../layout.ts";
import type { ClampEmits } from "../types.ts";
import type { LineClampExposed, LineClampProps, LineClampSlots } from "./types.ts";
import type { NativeClampMode } from "../native.ts";
import type { TextClampResult } from "../text.ts";

type LineFitResult = {
  readonly fit: SimpleLineFit | undefined;
  readonly metricsChanged: boolean;
};

type LineFitInput = {
  readonly fit: SimpleLineFit | undefined;
  readonly key: string;
};

defineOptions({
  name: "LineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  text = "",
  maxLines,
  maxHeight,
  ellipsis = "…",
  location = "end",
  boundary = "grapheme",
} = defineProps<Omit<LineClampProps, "expanded">>();
const expanded = defineModel<NonNullable<LineClampProps["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const slots = defineSlots<LineClampSlots>();
const attrs = useAttrs();
const predictor = useLineClampPredictor();

const textRef = shallowRef<HTMLElement | null>(null);
const predictiveWidthRef = predictor ? shallowRef<HTMLElement | null>(null) : undefined;
// Search writes the final text into the live node; the shallow snapshot only
// triggers Vue when the rendered structure must change.
const visibleText = shallowRef({ text });
const multilineBodyStyle: CSSProperties = { position: "relative" };
const overflowHiddenRootStyle: CSSProperties = { overflow: "hidden" };
let lastTextClamp: TextClampResult | null = null;
let lineFitCache: { fit: SimpleLineFit; key: string } | null = null;
let lineFitKey: string | null = null;
let predictionReady = false;

const lineLimit = computed(() => normalizeLineLimit(maxLines));
const preparedText = computed(() => prepareText(text, boundary));
const hasActiveClamp = computed(
  () =>
    !expanded.value &&
    text.length > 0 &&
    (lineLimit.value !== undefined || maxHeight !== undefined),
);

const {
  rootRef,
  contentRef,
  beforeRef,
  bodyRef,
  afterRef,
  isClamped,
  expand,
  collapse,
  toggle,
  observedSizeSnapshot,
  affixSlotProps,
  setBeforeElement,
  setAfterElement,
  requestRecompute,
} = useMultilineClamp({
  active: hasActiveClamp,
  expanded,
  onFontLoad: () => {
    lineFitCache = null;
    predictor?.invalidate();
  },
  onClampedChange: (value) => {
    emit("clampchange", value);
  },
  predictiveWidthRef,
  recompute: async (expanded, rootWidthSnapshot): Promise<void> => {
    const currentLineLimit = lineLimit.value;
    if (expanded.value || text.length === 0 || !hasClampLimit(currentLineLimit)) {
      // Expanded, empty, and unlimited states should expose the source text
      // directly so the DOM stays simple when no truncation is needed.
      await resetClamp();
      return;
    }

    const rootElement = rootRef.value;
    const contentElement = contentRef.value;
    const textElement = textRef.value;

    if (!rootElement || !contentElement || !textElement) {
      // Missing refs are a mount/teardown timing state; avoid caching a partial
      // measurement result.
      await resetClamp();
      return;
    }

    const locationRatio = normalizeLocationRatio(location);
    const nativeMode = getNativeMode(afterRef.value !== null, currentLineLimit, locationRatio);

    if (nativeMode) {
      // Browser native clamping is cheaper and more faithful for exact subsets
      // where CSS supports every requested behavior.
      resetTextClampHint();
      const clampedElement = nativeMode === "multi-line" ? contentElement : textElement;
      const nextClamped = measureNativeClamped(
        clampedElement,
        nativeMode,
        nativeMode === "multi-line" ? rootWidthSnapshot : undefined,
      );
      await applyTextState(text, nextClamped ?? false, false);
      return;
    }

    const beforeSize = observedSizeSnapshot(beforeRef.value);
    const afterSize = observedSizeSnapshot(afterRef.value);
    const predicting = usesPredictor();
    const rootWidth =
      rootWidthSnapshot ??
      (predicting
        ? observedSizeSnapshot(predictiveWidthRef?.value ?? null).width
        : borderBoxWidth(rootElement));
    if (predicting && rootWidthSnapshot === undefined && rootWidth <= 0) return;
    if (predicting && predictor && currentLineLimit !== undefined) {
      const prediction = predictor.predict({
        afterWidth: afterSize.width,
        beforeWidth: beforeSize.width,
        boundary,
        ellipsis,
        lineLimit: currentLineLimit,
        rootWidth,
        text,
        textElement,
      });
      if (prediction) {
        resetTextClampHint();
        if (visibleText.value.text !== prediction.text) {
          setElementText(textElement, prediction.text);
        }
        revealPrediction(textElement);
        await applyTextState(prediction.text, prediction.clamped, true);
        return;
      }
    }

    const layoutKey = `${beforeSize.signature}|${afterSize.signature}`;
    const hasAffixes =
      hasBorderBoxSize(beforeSize.signature) || hasBorderBoxSize(afterSize.signature);
    const prepared = preparedText.value;
    const lineCapacity = estimateLineCapacity(rootElement, maxHeight, currentLineLimit);
    const lineFitResult = lineFit(currentLineLimit, rootElement, textElement, layoutKey);
    const nextResult = clampTextToLayout({
      content: contentElement,
      ellipsis,
      hasAffixes,
      hint: lastTextClamp,
      lineCapacity,
      layoutKey,
      lineLimit: currentLineLimit,
      maxHeight,
      prepared,
      ratio: locationRatio,
      root: rootElement,
      rootWidth,
      reuseFullFitOnGrow: !lineFitResult.metricsChanged && !hasAffixes && maxHeight === undefined,
      simpleLineFit: lineFitResult.fit,
      target: textElement,
    });

    if (nextResult === null) {
      // A zero-width root cannot produce a stable clamp; keep source text until
      // layout becomes measurable.
      await resetClamp();
      return;
    }

    lastTextClamp = nextResult;
    if (predicting) revealPrediction(textElement);
    await applyTextState(nextResult.text, nextResult.text !== prepared.text, predicting);
  },
});

function usesPredictor(): boolean {
  if (!predictor || !hasActiveClamp.value) {
    return false;
  }

  const currentLineLimit = lineLimit.value;
  const locationRatio = normalizeLocationRatio(location);
  if (
    !predictor.supports({
      boundary,
      ellipsis,
      lineLimit: currentLineLimit,
      locationRatio,
      maxHeight,
    })
  ) {
    return false;
  }

  return getNativeMode(afterRef.value !== null, currentLineLimit, locationRatio) === null;
}

function revealPrediction(element: HTMLElement): void {
  if (predictionReady) return;
  element.style.visibility = "";
  predictionReady = true;
}

async function applyTextState(
  nextText: string,
  nextClamped: boolean,
  predicting: boolean,
): Promise<void> {
  const visible = visibleText.value;
  const structureChanged = !predicting && (visible.text !== text) !== (nextText !== text);
  const stateChanged = isClamped.value !== nextClamped;

  if (structureChanged) {
    visibleText.value = { text: nextText };
  } else {
    visible.text = nextText;
  }

  isClamped.value = nextClamped;

  if (structureChanged || stateChanged) {
    // DOM measurement has already completed synchronously; this tick only lets
    // Vue commit the final visible state before callers observe it.
    await nextTick();
  }
}

async function resetClamp(): Promise<void> {
  resetTextClampHint();
  return applyTextState(text, false, usesPredictor());
}

function resetTextClampHint(): void {
  lastTextClamp = null;
  resetLineFitState();
}

function hasClampLimit(currentLineLimit: number | undefined): boolean {
  return currentLineLimit !== undefined || maxHeight !== undefined;
}

function getNativeMode(
  hasAfterSlot: boolean,
  currentLineLimit: number | undefined,
  locationRatio: number,
): NativeClampMode | null {
  return resolveNativeMode({
    boundary,
    ellipsis,
    expanded: expanded.value,
    hasAfterSlot,
    lineLimit: currentLineLimit,
    locationRatio,
    maxHeight,
  });
}

function lineFit(
  currentLineLimit: number | undefined,
  rootElement: HTMLElement,
  textElement: HTMLElement,
  layoutKey: string,
): LineFitResult {
  if (currentLineLimit === undefined || maxHeight !== undefined) {
    return {
      fit: undefined,
      metricsChanged: false,
    };
  }

  const inlineFit = inlineRootLineFit(rootElement, layoutKey);
  if (inlineFit) {
    return applyLineFit(inlineFit);
  }

  const style = getComputedStyle(textElement);
  return applyLineFit({
    fit: simpleLineFitFromStyle(style),
    key: lineFitCacheKey(style, layoutKey),
  });
}

function inlineRootLineFit(rootElement: HTMLElement, layoutKey: string): LineFitInput | null {
  const style = rootElement.style;

  if (
    (rootElement.getAttribute("class") ?? "").trim() !== "" ||
    !hasInlineFontMetrics(style) ||
    !hasInlineLineMetrics(style) ||
    hasUnresolvedInlineTextWidthStyle(style)
  ) {
    return null;
  }

  const fit = simpleLineFitFromStyle(style);
  if (!fit) {
    return null;
  }

  return {
    fit,
    key: lineFitCacheKey(style, layoutKey),
  };
}

function applyLineFit({ fit: simpleLineFit, key }: LineFitInput): LineFitResult {
  const metricsChanged = lineFitKey !== null && lineFitKey !== key;
  lineFitKey = key;

  if (lineFitCache?.key === key) {
    return {
      fit: lineFitCache.fit,
      metricsChanged,
    };
  }

  const fit =
    simpleLineFit && (beforeRef.value !== null || afterRef.value !== null)
      ? { lineHeight: simpleLineFit.lineHeight, verifyOverflow: true }
      : simpleLineFit;
  lineFitCache = fit ? { fit, key } : null;

  return {
    fit,
    metricsChanged,
  };
}

function lineFitCacheKey(style: CSSStyleDeclaration, layoutKey: string): string {
  return `${layoutKey}\n${style.fontFamily}\n${style.fontFeatureSettings}\n${style.fontKerning}\n${style.fontSize}\n${style.fontStretch}\n${style.fontStyle}\n${style.fontVariant}\n${style.fontWeight}\n${style.letterSpacing}\n${style.lineHeight}\n${style.textTransform}\n${style.verticalAlign}\n${style.wordSpacing}`;
}

function resetLineFitState(): void {
  lineFitCache = null;
  lineFitKey = null;
}

function renderAffixSlot(part: "before" | "after", slotStyle: CSSProperties): VNodeChild | null {
  const slot = part === "before" ? slots.before : slots.after;
  if (!slot) {
    return null;
  }

  return renderMultilineAffixSlot({
    part,
    render: slot,
    setRef: part === "before" ? setBeforeElement : setAfterElement,
    slotProps: affixSlotProps(),
    slotStyle,
  });
}

function renderBody(
  renderedText: string,
  sourceIsHidden: boolean,
  nativeMode: NativeClampMode | null,
  predicting: boolean,
): VNodeChild {
  const predictivePending = predicting && !predictionReady;
  const textNode = h(
    "span",
    {
      "aria-hidden": trueOrUndefined(sourceIsHidden),
      key: "text",
      ref: textRef,
      style:
        nativeMode === "single-line"
          ? nativeTextStyle
          : predictivePending
            ? predictivePendingStyle
            : undefined,
    },
    [renderedText],
  );

  return h(
    "span",
    {
      "data-part": "body",
      ref: bodyRef,
      style: nativeMode === "single-line" ? nativeBodyStyle : multilineBodyStyle,
    },
    sourceIsHidden ? [h("span", { style: visuallyHiddenTextStyle }, text), textNode] : textNode,
  );
}

function render(): VNodeChild {
  // Use the rendered after wrapper rather than `slots.after`: filtered or
  // dynamic slots can be declared while producing no DOM, and native clamp
  // remains valid.
  const currentText = visibleText.value.text;
  const lineLimitValue = lineLimit.value;
  const locationRatio = normalizeLocationRatio(location);
  const nativeMode = getNativeMode(afterRef.value !== null, lineLimitValue, locationRatio);
  const predicting = usesPredictor();
  const slotStyle = nativeMode === "single-line" ? multilineNativeSlotStyle : multilineSlotStyle;
  const hasLimit = hasClampLimit(lineLimitValue);
  const sourceIsHidden =
    !nativeMode && hasLimit && !expanded.value && (predicting || currentText !== text);
  const rendersSourceText =
    nativeMode || expanded.value || (!predicting && currentText.length === 0) || !hasLimit;
  const renderedText = rendersSourceText ? text : currentText;
  const collapsedMaxHeight = !expanded.value ? cssLength(maxHeight) : undefined;
  const rootStyle =
    collapsedMaxHeight === undefined
      ? predicting
        ? predictiveRootStyle
        : overflowHiddenRootStyle
      : { maxHeight: collapsedMaxHeight, overflow: "hidden" };
  const children: VNodeChild[] = [];
  const beforeSlot = renderAffixSlot("before", slotStyle);
  if (beforeSlot) {
    children.push(beforeSlot);
  }

  children.push(renderBody(renderedText, sourceIsHidden, nativeMode, predicting));

  const afterSlot = renderAffixSlot("after", slotStyle);
  if (afterSlot) {
    children.push(afterSlot);
  }

  const content = h(
    "span",
    {
      "data-part": "content",
      ref: contentRef,
      // Prediction chooses the visible prefix; line-clamp remains as a
      // line-box-aware safety net for browser shaping outside its model.
      style: getNativeContentStyle(
        nativeMode ?? (predicting ? "multi-line" : null),
        lineLimitValue,
      ),
    },
    children,
  );

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      ref: rootRef,
      style: rootStyle,
    }),
    predicting
      ? [
          h("span", {
            "aria-hidden": true,
            ref: predictiveWidthRef,
            style: predictiveWidthStyle,
          }),
          content,
        ]
      : content,
  );
}

defineRender(render);

watch(
  [() => text, () => maxLines, () => maxHeight, () => ellipsis, () => location, () => boundary],
  () => {
    // Any semantic prop change invalidates the previous kept-count hint.
    resetTextClampHint();
    if (usesPredictor()) {
      predictionReady = false;
      if (textRef.value) textRef.value.style.visibility = "hidden";
    }
    visibleText.value = { text };
    requestRecompute();
  },
  { flush: "post" },
);

watch(
  usesPredictor,
  (value) => {
    predictionReady = false;
    if (textRef.value) textRef.value.style.visibility = value ? "hidden" : "";
    requestRecompute();
  },
  { flush: "sync" },
);

defineExpose({
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
</script>
