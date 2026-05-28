<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch } from "vue";
import { trueOrUndefined } from "../attributes.ts";
import { cssLength, normalizeLineLimit } from "../layout.ts";
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

import type { ComponentPublicInstance, CSSProperties, VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type {
  LineClampExposed,
  LineClampProps,
  LineClampSlotProps,
  LineClampSlots,
} from "./types.ts";
import type { NativeClampMode } from "../native.ts";
import type { TextClampResult } from "../text.ts";

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
const visibleText = shallowRef(text);
const multilineBodyStyle: CSSProperties = { position: "relative" };
const overflowHiddenRootStyle: CSSProperties = { overflow: "hidden" };
let lastTextClamp: TextClampResult | null = null;

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
  requestRecompute,
} = useMultilineClamp({
  expanded,
  onClampedChange: (value) => {
    emit("clampchange", value);
  },
  recompute: async (expanded): Promise<void> => {
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

    const nativeMode = getNativeMode(afterRef.value !== null, currentLineLimit);

    if (nativeMode) {
      // Browser native clamping is cheaper and more faithful for exact subsets
      // where CSS supports every requested behavior.
      lastTextClamp = null;
      const clampedElement = nativeMode === "multi-line" ? contentElement : textElement;
      const nextClamped = measureNativeClamped(clampedElement, nativeMode);
      await applyTextState(text, nextClamped ?? false);
      return;
    }

    const prepared = preparedText.value;
    const nextResult = clampTextToLayout({
      content: contentElement,
      ellipsis,
      hint: lastTextClamp,
      lineLimit: currentLineLimit,
      maxHeight,
      prepared,
      ratio: normalizeLocationRatio(location),
      root: rootElement,
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
  const changed = visibleText.value !== nextText || isClamped.value !== nextClamped;

  visibleText.value = nextText;
  isClamped.value = nextClamped;

  if (changed) {
    // DOM measurement has already completed synchronously; this tick only lets
    // Vue commit the final visible state before callers observe it.
    await nextTick();
  }
}

async function resetClamp(): Promise<void> {
  lastTextClamp = null;
  return applyTextState(text, false);
}

function hasClampLimit(currentLineLimit = lineLimit.value): boolean {
  return currentLineLimit !== undefined || maxHeight !== undefined;
}

function getNativeMode(
  hasAfterSlot: boolean,
  currentLineLimit = lineLimit.value,
): NativeClampMode | null {
  return resolveNativeMode({
    boundary,
    ellipsis,
    expanded: expanded.value,
    hasAfterSlot,
    lineLimit: currentLineLimit,
    locationRatio: normalizeLocationRatio(location),
    maxHeight,
  });
}

function setAffixElement(
  target: typeof beforeRef,
  element: ComponentPublicInstance | Element | null,
): void {
  const nextElement = element instanceof HTMLElement ? element : null;
  if (target.value === nextElement) {
    return;
  }

  target.value = nextElement;
  // Slot wrappers can appear or disappear after their render function is
  // filtered, so measure on the next tick after Vue commits that DOM change.
  void nextTick(requestRecompute);
}

function setBeforeElement(element: ComponentPublicInstance | Element | null): void {
  setAffixElement(beforeRef, element);
}

function setAfterElement(element: ComponentPublicInstance | Element | null): void {
  setAffixElement(afterRef, element);
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
    slotProps: {
      expand,
      collapse,
      toggle,
      clamped: isClamped.value,
      expanded: expanded.value,
    } satisfies LineClampSlotProps,
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
  const lineLimitValue = lineLimit.value;
  const nativeMode = getNativeMode(afterRef.value !== null, lineLimitValue);
  const slotStyle = nativeMode === "single-line" ? multilineNativeSlotStyle : multilineSlotStyle;
  const hasLimit = hasClampLimit(lineLimitValue);
  const sourceIsHidden = !nativeMode && visibleText.value !== text && hasLimit && !expanded.value;
  const rendersSourceText =
    nativeMode || expanded.value || visibleText.value.length === 0 || !hasLimit;
  const renderedText = rendersSourceText ? text : visibleText.value;
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
    lastTextClamp = null;
    visibleText.value = text;
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
