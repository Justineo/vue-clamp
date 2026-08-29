<script setup lang="ts">
import { computed, h, mergeProps, shallowRef, useAttrs, watch, watchPostEffect } from "vue";
import { useClampControls } from "../controls.ts";
import { normalizeLineLimit, observeBorderBoxSizes } from "../layout.ts";
import StandardLineClamp from "../line/LineClamp.vue";
import { visuallyHiddenTextStyle } from "../styles.ts";
import { normalizeLocationRatio, setElementText } from "../text.ts";
import { clampPreparedLine, prepareLineClamp } from "./clamp.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { PrepareOptions } from "@chenglou/pretext";
import type { LineClampExposed, LineClampProps, LineClampSlots } from "../line/types.ts";
import type { ClampEmits } from "../types.ts";

type Typography = {
  readonly font: string;
  readonly options: PrepareOptions;
};

defineOptions({
  name: "LineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  boundary = "grapheme",
  ellipsis = "…",
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
const bodyRef = shallowRef<HTMLElement | null>(null);
const visibleRef = shallowRef<HTMLElement | null>(null);
// ResizeObserver delivers before paint, so stable DOM ownership lets the
// callback commit a prefix without waiting for a Vue patch.
let visibleText = text;
const clamped = shallowRef(false);
const lineLimit = computed(() => normalizeLineLimit(maxLines));
const predictiveProps = computed(
  () =>
    maxHeight === undefined &&
    // Final-line reservation treats the marker as one unit; forced breaks need
    // the browser-authoritative candidate layout.
    !/[\n\r\f]/u.test(ellipsis) &&
    normalizeLocationRatio(location) === 1 &&
    (boundary === "word" || ellipsis !== "…") &&
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
let typography: Typography | null = null;
let observedWidth: number | null = null;
let predictionReady = false;

function readTypography(): Typography | null {
  const body = bodyRef.value;
  if (!body) return null;

  const style = getComputedStyle(body);
  const font = style.font.trim() || fallbackFont(style);
  const letterSpacing = Number.parseFloat(style.letterSpacing);
  const options: PrepareOptions = {
    letterSpacing:
      Number.isFinite(letterSpacing) && letterSpacing !== 0 ? letterSpacing : undefined,
    whiteSpace: style.whiteSpace === "pre-wrap" ? "pre-wrap" : undefined,
    wordBreak: style.wordBreak === "keep-all" ? "keep-all" : undefined,
  };
  return {
    font,
    options,
  };
}

function fallbackFont(style: CSSStyleDeclaration): string {
  const variant = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal";
  return [
    style.fontStyle,
    variant,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ].join(" ");
}

const prepared = computed(() => {
  if (!shouldUsePretext()) return null;

  typography ??= readTypography();
  if (!typography) return null;

  return prepareLineClamp(text, typography.font, {
    ...typography.options,
    boundary,
    ellipsis,
  });
});

function resolve(): void {
  if (!shouldUsePretext()) return;

  const limit = lineLimit.value;
  if (expanded.value || text.length === 0 || limit === undefined) {
    applyResult({ clamped: false, text });
    return;
  }

  if (observedWidth === null) return;

  const current = prepared.value;
  if (current) applyResult(clampPreparedLine(current, observedWidth, limit));
}

function applyResult(result: ReturnType<typeof clampPreparedLine>): void {
  if (visibleText !== result.text) {
    if (visibleRef.value) setElementText(visibleRef.value, result.text);
    visibleText = result.text;
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
  display: "block",
  height: 0,
  margin: 0,
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
    lineClamp: isActive ? String(limit) : undefined,
    overflow: "hidden",
    width: "100%",
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

  const stop = observeBorderBoxSizes([widthProbe], ([entry]) => {
    if (!entry) return;

    const nextWidth = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
    if (nextWidth === observedWidth) return;

    observedWidth = nextWidth;
    resolve();
  });

  onCleanup(stop);
});

watch(clamped, (value) => emit("clampchange", value), { flush: "post", immediate: true });

watch([expanded, lineLimit, predictiveProps, prepared], resolve, { immediate: true });
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
    [visibleText],
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
          ref: bodyRef,
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
    return clamped.value;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies LineClampExposed);
</script>
