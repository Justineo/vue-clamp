<script setup lang="ts">
import { computed, h, mergeProps, shallowRef, useAttrs, watch, watchPostEffect } from "vue";
import { useClampControls } from "../controls.ts";
import { normalizeLineLimit } from "../layout.ts";
import { visuallyHiddenTextStyle } from "../styles.ts";
import { clampPreparedLine, prepareLineClamp } from "./clamp.ts";
import { observeContentBox } from "./resize.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { LineClampExposed, LineClampProps } from "./types.ts";

defineOptions({
  name: "LineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  font,
  maxLines,
  text = "",
} = defineProps<Omit<LineClampProps, "expanded">>();
const expanded = defineModel<NonNullable<LineClampProps["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const attrs = useAttrs();
const controls = useClampControls(expanded);
const widthRef = shallowRef<HTMLElement | null>(null);
const visibleRef = shallowRef<HTMLElement | null>(null);
// ResizeObserver delivers before paint, so stable DOM ownership lets the
// callback commit a prefix without waiting for a Vue patch.
const visibleText = { text };
const clamped = shallowRef<boolean | null>(null);
const lineLimit = computed(() => normalizeLineLimit(maxLines));
const active = computed(() => !expanded.value && text.length > 0 && lineLimit.value !== undefined);
const prepared = computed(() => prepareLineClamp(text, font));
let observedWidth: number | null = null;

function resolve(): void {
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

  clamped.value = result.clamped;
}

const rootStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
};
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
    maxHeight: isActive ? `${limit}lh` : undefined,
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

watch([expanded, lineLimit, () => font, () => text], resolve, { immediate: true });

function render(): VNodeChild {
  const visible = h(
    "span",
    {
      "aria-hidden": true,
      key: "visible",
      ref: visibleRef,
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
