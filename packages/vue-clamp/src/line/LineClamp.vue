<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch } from "vue";
import { trueOrUndefined } from "../attributes.ts";
import { borderBoxWidth, cssLength, normalizeLineLimit } from "../layout.ts";
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
import { visuallyHiddenTextStyle } from "../styles.ts";
import { clampTextToLayout, normalizeLocationRatio, prepareText } from "../text.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { LineClampExposed, LineClampProps, LineClampSlots } from "./types.ts";
import type { NativeClampMode } from "../native.ts";
import type { PreparedText, TextClampResult } from "../text.ts";

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

const textRef = shallowRef<HTMLElement | null>(null);
// Search writes the final text into the live node; the shallow snapshot only
// triggers Vue when the rendered structure must change.
const visibleText = shallowRef({ text });
const multilineBodyStyle: CSSProperties = { position: "relative" };
const overflowHiddenRootStyle: CSSProperties = { overflow: "hidden" };
let lastTextClamp: TextClampResult | null = null;
const fullFitSkipGrowLimit = 24;

const lineLimit = computed(() => normalizeLineLimit(maxLines));
const preparedText = computed(() => prepareText(text, boundary));

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
  affixSlotProps,
  setBeforeElement,
  setAfterElement,
  requestRecompute,
} = useMultilineClamp({
  expanded,
  onClampedChange: (value) => {
    emit("clampchange", value);
  },
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
      await applyTextState(text, nextClamped ?? false);
      return;
    }

    const prepared = preparedText.value;
    const rootWidth = rootWidthSnapshot ?? borderBoxWidth(rootElement);
    const nextResult = clampTextToLayout({
      content: contentElement,
      ellipsis,
      hint: lastTextClamp,
      lineLimit: currentLineLimit,
      maxHeight,
      prepared,
      ratio: locationRatio,
      root: rootElement,
      rootWidth,
      skipFullFit: canSkipFullTextFit(prepared, rootWidth),
      target: textElement,
    });

    if (nextResult === null) {
      // A zero-width root cannot produce a stable clamp; keep source text until
      // layout becomes measurable.
      await resetClamp();
      return;
    }

    lastTextClamp = nextResult;
    await applyTextState(nextResult.text, nextResult.text !== prepared.text);
  },
});

async function applyTextState(nextText: string, nextClamped: boolean): Promise<void> {
  const visible = visibleText.value;
  const sourceHiddenChanged = (visible.text !== text) !== (nextText !== text);
  const changed = sourceHiddenChanged || isClamped.value !== nextClamped;

  if (changed) {
    visibleText.value = { text: nextText };
  } else {
    visible.text = nextText;
  }

  isClamped.value = nextClamped;

  if (changed) {
    // DOM measurement has already completed synchronously; this tick only lets
    // Vue commit the final visible state before callers observe it.
    await nextTick();
  }
}

async function resetClamp(): Promise<void> {
  resetTextClampHint();
  return applyTextState(text, false);
}

function resetTextClampHint(): void {
  lastTextClamp = null;
}

function canSkipFullTextFit(prepared: PreparedText, rootWidth: number): boolean {
  const last = lastTextClamp;
  if (last === null) {
    return false;
  }

  const boundaryCount = prepared.boundaryOffsets.length - 1;
  return (
    last.boundaryOffsets === prepared.boundaryOffsets &&
    last.kept < boundaryCount &&
    last.rootWidth !== undefined &&
    rootWidth <= last.rootWidth + fullFitSkipGrowLimit
  );
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
): VNodeChild {
  const textNode = h(
    "span",
    {
      "aria-hidden": trueOrUndefined(sourceIsHidden),
      key: "text",
      ref: textRef,
      style: nativeMode === "single-line" ? nativeTextStyle : undefined,
    },
    renderedText,
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
  const slotStyle = nativeMode === "single-line" ? multilineNativeSlotStyle : multilineSlotStyle;
  const hasLimit = hasClampLimit(lineLimitValue);
  const sourceIsHidden = !nativeMode && currentText !== text && hasLimit && !expanded.value;
  const rendersSourceText = nativeMode || expanded.value || currentText.length === 0 || !hasLimit;
  const renderedText = rendersSourceText ? text : currentText;
  const collapsedMaxHeight = !expanded.value ? cssLength(maxHeight) : undefined;
  const rootStyle =
    collapsedMaxHeight === undefined
      ? overflowHiddenRootStyle
      : { maxHeight: collapsedMaxHeight, overflow: "hidden" };
  const children: VNodeChild[] = [];
  const beforeSlot = renderAffixSlot("before", slotStyle);
  if (beforeSlot) {
    children.push(beforeSlot);
  }

  children.push(renderBody(renderedText, sourceIsHidden, nativeMode));

  const afterSlot = renderAffixSlot("after", slotStyle);
  if (afterSlot) {
    children.push(afterSlot);
  }

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      ref: rootRef,
      style: rootStyle,
    }),
    h(
      "span",
      {
        "data-part": "content",
        ref: contentRef,
        style: getNativeContentStyle(nativeMode, lineLimitValue),
      },
      children,
    ),
  );
}

defineRender(render);

watch(
  [() => text, () => maxLines, () => maxHeight, () => ellipsis, () => location, () => boundary],
  () => {
    // Any semantic prop change invalidates the previous kept-count hint.
    resetTextClampHint();
    visibleText.value.text = text;
    requestRecompute();
  },
  { flush: "post" },
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
