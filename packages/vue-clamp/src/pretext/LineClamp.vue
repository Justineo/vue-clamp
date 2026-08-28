<script setup lang="ts">
import { computed, h, mergeProps, shallowRef, useAttrs, watch, watchPostEffect } from "vue";
import { useClampControls } from "../controls.ts";
import { normalizeLineLimit } from "../layout.ts";
import StandardLineClamp from "../line/LineClamp.vue";
import { visuallyHiddenTextStyle } from "../styles.ts";
import { normalizeLocationRatio } from "../text.ts";
import { clampPreparedLine, prepareLineClamp } from "./clamp.ts";
import { observeContentBox } from "./resize.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { LineClampExposed, LineClampProps, LineClampSlots } from "./types.ts";

defineOptions({
  name: "LineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  boundary = "grapheme",
  ellipsis = "…",
  font,
  location = "end",
  maxHeight,
  maxLines,
  text = "",
} = defineProps<Omit<LineClampProps, "expanded">>();
const expanded = defineModel<NonNullable<LineClampProps["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const slots = defineSlots<LineClampSlots>();
const attrs = useAttrs();
const controls = useClampControls(expanded);
const widthRef = shallowRef<HTMLElement | null>(null);
const visibleRef = shallowRef<HTMLElement | null>(null);
// ResizeObserver delivers before paint, so stable DOM ownership lets the
// callback commit a prefix without waiting for a Vue patch.
const visibleText = { text };
const clamped = shallowRef<boolean | null>(null);
const lineLimit = computed(() => normalizeLineLimit(maxLines));
const predictiveProps = computed(
  () =>
    font !== undefined &&
    font.trim() !== "" &&
    maxHeight === undefined &&
    ellipsis === "…" &&
    normalizeLocationRatio(location) === 1 &&
    boundary === "word" &&
    lineLimit.value !== undefined,
);
// Once an affix participates, keep this instance browser-authoritative even if
// a dynamic slot later disappears. This avoids switching back on non-reactive
// slot metadata and is conservative for both semantics and performance.
let affixFree = slots.before === undefined && slots.after === undefined;

function shouldUsePretext(): boolean {
  if (slots.before !== undefined || slots.after !== undefined) affixFree = false;
  return affixFree && predictiveProps.value;
}

const active = computed(
  () => affixFree && predictiveProps.value && !expanded.value && text.length > 0,
);
const prepared = computed(() => prepareLineClamp(text, font!));
let observedWidth: number | null = null;
let predictionReady = false;

function resolve(): void {
  if (!shouldUsePretext()) return;

  const limit = lineLimit.value;
  if (expanded.value || text.length === 0 || limit === undefined) {
    applyResult({ clamped: false, text });
    return;
  }

  if (observedWidth === null) return;

  applyResult(clampPreparedLine(prepared.value, observedWidth, limit));
}

function applyResult(result: ReturnType<typeof clampPreparedLine>): void {
  if (visibleText.text !== result.text) {
    const textNode = visibleRef.value?.firstChild;
    if (textNode?.nodeType === 3) textNode.nodeValue = result.text;
    visibleText.text = result.text;
  }

  if (active.value && !predictionReady) {
    if (visibleRef.value) visibleRef.value.style.visibility = "";
    predictionReady = true;
  }

  clamped.value = result.clamped;
}

const rootStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
};
const pendingStyle: CSSProperties = { visibility: "hidden" };
// A zero-height target avoids observer loops when the visible text changes
// the body's block size.
const widthProbeStyle: CSSProperties = {
  border: 0,
  boxSizing: "border-box",
  display: "block",
  height: 0,
  margin: 0,
  maxHeight: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: 0,
  visibility: "hidden",
  width: "100%",
};
const bodyStyle = computed<CSSProperties>(() => {
  const limit = lineLimit.value;
  const isActive = active.value;

  return {
    display: isActive ? "-webkit-box" : "block",
    font,
    fontFeatureSettings: "normal",
    fontKerning: "auto",
    fontOpticalSizing: "auto",
    fontVariationSettings: "normal",
    hyphens: "manual",
    letterSpacing: "normal",
    lineBreak: "auto",
    lineClamp: isActive ? String(limit) : undefined,
    lineHeight: "inherit",
    overflow: "hidden",
    overflowWrap: "break-word",
    tabSize: 8,
    textIndent: 0,
    textTransform: "none",
    whiteSpace: "normal",
    width: "100%",
    wordBreak: "normal",
    wordSpacing: "normal",
    writingMode: "horizontal-tb",
    WebkitBoxOrient: isActive ? "vertical" : undefined,
    WebkitLineClamp: isActive ? String(limit) : undefined,
  };
});

watchPostEffect((onCleanup) => {
  const widthProbe = widthRef.value;
  if (!widthProbe || !active.value) {
    observedWidth = null;
    return;
  }

  const stop = observeContentBox(widthProbe, (entry) => {
    const nextWidth = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
    if (nextWidth === observedWidth) return;

    observedWidth = nextWidth;
    resolve();
  });

  onCleanup(stop);
});

watch(
  clamped,
  (value) => {
    if (value !== null) emit("clampchange", value);
  },
  { flush: "post" },
);

watch([expanded, lineLimit, predictiveProps, () => font, () => text], resolve, { immediate: true });
watch(
  active,
  (value) => {
    if (!value) predictionReady = false;
  },
  { flush: "sync" },
);

function render(): VNodeChild {
  if (!shouldUsePretext()) {
    return h(
      StandardLineClamp,
      mergeProps(attrs, {
        as: rootTag,
        boundary,
        ellipsis,
        expanded: expanded.value,
        location,
        maxHeight,
        maxLines,
        onClampchange: (value: boolean) => {
          clamped.value = value;
        },
        "onUpdate:expanded": (value: boolean) => {
          expanded.value = value;
        },
        style: font ? { font } : undefined,
        text,
      }),
      slots,
    );
  }

  const visible = h(
    "span",
    {
      "aria-hidden": true,
      key: "visible",
      ref: visibleRef,
      style: active.value && !predictionReady ? pendingStyle : undefined,
    },
    [visibleText.text],
  );

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      style: rootStyle,
    }),
    [
      h("span", { "aria-hidden": true, ref: widthRef, style: widthProbeStyle }),
      h(
        "span",
        {
          "data-part": "body",
          style: bodyStyle.value,
        },
        [h("span", { key: "source", style: visuallyHiddenTextStyle }, text), visible],
      ),
    ],
  );
}

defineRender(render);

defineExpose({
  ...controls,
  get clamped() {
    return clamped.value === true;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies LineClampExposed);
</script>
