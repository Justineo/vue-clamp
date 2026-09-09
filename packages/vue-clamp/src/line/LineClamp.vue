<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch, withMemo } from "vue";
import { trueOrUndefined } from "../attributes.ts";
import {
  borderBoxWidth,
  cssLength,
  estimateLineCapacity,
  hasBorderBoxSize,
  hasMeasuredPeers,
  normalizeLineLimit,
  observeBorderBoxSizes,
  observeMeasuredBorderBoxSizes,
  simpleLineFitFromStyle,
  textLayoutMetricKey,
} from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { hasExplicitTextWidth, measureLayout } from "../measure.ts";
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
import {
  clampTextToLayout,
  searchTextLayout,
  normalizeLocationRatio,
  prepareSharedText,
  setElementText,
} from "../text.ts";
import { useLineClampPredictor } from "./predictor.ts";

import type { CSSProperties, VNode, VNodeChild } from "vue";
import type { BorderBoxSizeSnapshot, SimpleLineFit } from "../layout.ts";
import type { ClampEmits } from "../types.ts";
import type { LineClampExposed, LineClampProps, LineClampSlots } from "./types.ts";
import type { NativeClampMode } from "../native.ts";
import type { TextClampResult } from "../text.ts";

type LineFitResult = {
  readonly fit: SimpleLineFit | undefined;
  readonly metricsChanged: boolean;
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
const preparedText = computed(() => prepareSharedText(text, boundary));
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
  observeSizes: (elements, listener) => {
    const serial =
      usesPredictor() ||
      getNativeMode(afterRef.value !== null, lineLimit.value, normalizeLocationRatio(location)) !==
        null;
    return (serial ? observeBorderBoxSizes : observeMeasuredBorderBoxSizes)(elements, listener);
  },
  expanded,
  notifySettledReady: predictor !== null,
  onFontLoad: () => {
    lineFitCache = null;
    // Keep only the current marked text's semantic rank for a fresh DOM anchor.
    // Font changes invalidate every width observation and full-fit conclusion.
    if (lastTextClamp && !lastTextClamp.fullPrepared) {
      const semanticHint = { ...lastTextClamp };
      delete semanticHint.rootWidth;
      delete semanticHint.clampedMaxWidth;
      lastTextClamp = semanticHint;
    } else {
      lastTextClamp = null;
    }
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
      // Native rendering already committed the full source with no hidden copy.
      visibleText.value.text = text;
      await applyTextState(text, nextClamped ?? false, false);
      return;
    }

    const beforeElement = beforeRef.value;
    const afterElement = afterRef.value;
    const beforeSize = observedSizeSnapshot(beforeElement);
    const afterSize = observedSizeSnapshot(afterElement);
    const predicting = usesPredictor(nativeMode);
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
    const textStyle = getComputedStyle(textElement);
    const lineCapacity = estimateLineCapacity(
      rootElement,
      maxHeight,
      currentLineLimit,
      textStyle.lineHeight,
    );
    const lineFitResult = lineFit(currentLineLimit, textStyle, layoutKey);
    if (lineFitResult.metricsChanged) lastTextClamp = null;
    const input = {
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
    };
    // Candidate writes only change the body text. Slot rendering happens after
    // the search commits; each pass keeps its current affix elements and metrics.
    // Full-text reuse has no iterative layout work to amortize across instances.
    let settled: Promise<void> | undefined;
    function commit(nextResult: TextClampResult | null): void {
      if (nextResult === null) {
        settled = resetClamp();
      } else {
        lastTextClamp = nextResult;
        if (predicting) revealPrediction(textElement!);
        settled = applyTextState(nextResult.text, nextResult.text !== prepared.text, predicting);
      }
    }
    if (
      !predicting &&
      hasMeasuredPeers() &&
      ellipsis.length > 0 &&
      lastTextClamp?.text !== prepared.text &&
      hasExplicitTextWidth(rootElement)
    ) {
      await measureLayout(
        searchTextLayout(input, false),
        () =>
          rootRef.value === rootElement &&
          textRef.value === textElement &&
          preparedText.value === prepared &&
          hasActiveClamp.value &&
          lineLimit.value === currentLineLimit &&
          maxHeight === input.maxHeight &&
          ellipsis === input.ellipsis &&
          normalizeLocationRatio(location) === locationRatio &&
          beforeRef.value === beforeElement &&
          afterRef.value === afterElement,
        commit,
      );
      // Completion commits inside Vue's flush. Its recursive render pass has
      // settled before this await resumes; another tick would delay queued inputs.
    } else {
      commit(clampTextToLayout(input));
      await settled;
    }
  },
});

function usesPredictor(
  nativeMode = getNativeMode(
    afterRef.value !== null,
    lineLimit.value,
    normalizeLocationRatio(location),
  ),
): boolean {
  if (!predictor || !hasActiveClamp.value) {
    return false;
  }

  const currentLineLimit = lineLimit.value;
  const locationRatio = normalizeLocationRatio(location);
  if (
    !predictor.supports({
      ellipsis,
      lineLimit: currentLineLimit,
      locationRatio,
      maxHeight,
    })
  ) {
    return false;
  }

  return nativeMode === null;
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
  style: CSSStyleDeclaration,
  layoutKey: string,
): LineFitResult {
  const simpleLineFit =
    currentLineLimit !== undefined && maxHeight === undefined
      ? simpleLineFitFromStyle(style)
      : undefined;
  const key = `${layoutKey}\n${textLayoutMetricKey(style)}`;
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
  renderCache: VNode[],
): VNodeChild {
  const predictivePending = predicting && !predictionReady;
  // Width-only updates often keep the same text and attributes. Reuse this
  // internal leaf without caching body layout or consumer-owned slot output.
  // Vue owns the cache and clears it when the leaf is unmounted.
  const textNode = withMemo(
    [renderedText, sourceIsHidden, nativeMode, predictivePending],
    () =>
      h(
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
      ),
    renderCache,
    0,
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

function render(_context: unknown, renderCache: VNode[]): VNodeChild {
  // Use the rendered after wrapper rather than `slots.after`: filtered or
  // dynamic slots can be declared while producing no DOM, and native clamp
  // remains valid.
  const currentText = visibleText.value.text;
  const lineLimitValue = lineLimit.value;
  const locationRatio = normalizeLocationRatio(location);
  const nativeMode = getNativeMode(afterRef.value !== null, lineLimitValue, locationRatio);
  const predicting = usesPredictor(nativeMode);
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

  children.push(renderBody(renderedText, sourceIsHidden, nativeMode, predicting, renderCache));

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
    // Commit only the solved state. A temporary full-source state would schedule
    // another Vue render even when the hidden-source structure stays unchanged.
    requestRecompute();
  },
  { flush: "post" },
);

if (predictor) {
  watch(
    usesPredictor,
    (value) => {
      predictionReady = false;
      if (textRef.value) textRef.value.style.visibility = value ? "hidden" : "";
      requestRecompute();
    },
    { flush: "sync" },
  );
}

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
