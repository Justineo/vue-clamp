<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue";
import { trueOrUndefined } from "../attributes.ts";
import { cssLength, normalizeLineLimit } from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { MultilineAffixSlot } from "../multiline-render.ts";
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

import type { CSSProperties } from "vue";
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

const textRef = useTemplateRef("textElement");
const visibleText = shallowRef(text);
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
    if (expanded.value || text.length === 0 || !hasClampLimit()) {
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

    const nativeMode = getNativeMode(afterRef.value !== null);

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
      lineLimit: lineLimit.value,
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

const slotProps = computed<LineClampSlotProps>(() => ({
  expand,
  collapse,
  toggle,
  clamped: isClamped.value,
  expanded: expanded.value,
}));

// Use the rendered after wrapper rather than `slots.after`: filtered or dynamic
// slots can be declared while producing no DOM, and native clamp remains valid.
const nativeMode = computed(() => getNativeMode(afterRef.value !== null));
const rootStyle = computed<CSSProperties>(() => ({
  maxHeight: !expanded.value ? cssLength(maxHeight) : undefined,
  overflow: "hidden",
}));
const contentStyle = computed(() => getNativeContentStyle(nativeMode.value, lineLimit.value));
const affixSlotStyle = computed(() =>
  nativeMode.value === "single-line" ? multilineNativeSlotStyle : multilineSlotStyle,
);
const needsAccessibleSourceText = computed(
  () => !nativeMode.value && visibleText.value !== text && hasClampLimit() && !expanded.value,
);
const bodyStyle = computed<CSSProperties>(() =>
  nativeMode.value === "single-line" ? nativeBodyStyle : { position: "relative" },
);
const renderedText = computed(() => {
  const shouldRenderFullText =
    nativeMode.value || expanded.value || visibleText.value.length === 0 || !hasClampLimit();
  return shouldRenderFullText ? text : visibleText.value;
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

function hasClampLimit(): boolean {
  return lineLimit.value !== undefined || maxHeight !== undefined;
}

function getNativeMode(hasAfterSlot: boolean): NativeClampMode | null {
  return resolveNativeMode({
    boundary,
    ellipsis,
    expanded: expanded.value,
    hasAfterSlot,
    lineLimit: lineLimit.value,
    locationRatio: normalizeLocationRatio(location),
    maxHeight,
  });
}

function setAffixElement(target: typeof beforeRef, element: Element | null): void {
  const nextElement = element instanceof HTMLElement ? element : null;
  if (target.value === nextElement) {
    return;
  }

  target.value = nextElement;
  // Slot wrappers can appear or disappear after their render function is
  // filtered, so measure on the next tick after Vue commits that DOM change.
  void nextTick(requestRecompute);
}

function setBeforeElement(element: Element | null): void {
  setAffixElement(beforeRef, element);
}

function setAfterElement(element: Element | null): void {
  setAffixElement(afterRef, element);
}

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

<template>
  <component :is="rootTag" v-bind="$attrs" data-part="root" ref="rootRef" :style="rootStyle">
    <span data-part="content" ref="contentRef" :style="contentStyle">
      <MultilineAffixSlot
        part="before"
        :render="slots.before"
        :setRef="setBeforeElement"
        :slotProps="slotProps"
        :slotStyle="affixSlotStyle"
      />

      <span data-part="body" ref="bodyRef" :style="bodyStyle">
        <span v-if="needsAccessibleSourceText" :style="visuallyHiddenTextStyle">
          {{ text }}
        </span>
        <span
          ref="textElement"
          key="text"
          :aria-hidden="trueOrUndefined(needsAccessibleSourceText)"
          :style="nativeMode === 'single-line' ? nativeTextStyle : undefined"
        >
          {{ renderedText }}
        </span>
      </span>

      <MultilineAffixSlot
        part="after"
        :render="slots.after"
        :setRef="setAfterElement"
        :slotProps="slotProps"
        :slotStyle="affixSlotStyle"
      />
    </span>
  </component>
</template>
