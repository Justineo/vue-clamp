<script setup lang="ts">
import { computed, h, mergeProps, shallowRef, useAttrs, watch, watchPostEffect } from "vue";
import { trueOrUndefined } from "../attributes.ts";
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
const bodyRef = shallowRef<HTMLElement | null>(null);
const width = shallowRef<number | null>(null);
const fontReady = shallowRef(false);
const isClamped = shallowRef(false);
const lineLimit = computed(() => normalizeLineLimit(maxLines));
const prepared = computed(() => prepareLineClamp(text, font));
let fontRequest = 0;
let hasResolved = false;

type Result = ReturnType<typeof clampPreparedLine> | null;

const result = computed<Result>((previous) => {
  const limit = lineLimit.value;
  if (expanded.value || text.length === 0 || limit === undefined) {
    const next = { clamped: false, text };
    return previous?.clamped === next.clamped && previous.text === next.text ? previous : next;
  }

  if (!fontReady.value || width.value === null) {
    return null;
  }

  const next = clampPreparedLine(prepared.value, width.value, limit);
  return previous?.clamped === next.clamped && previous.text === next.text ? previous : next;
});

const rootStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
};
const bodyStyle = computed<CSSProperties>(() => {
  const limit = lineLimit.value;
  const active = !expanded.value && text.length > 0 && limit !== undefined;

  return {
    display: active ? "-webkit-box" : "block",
    font,
    fontFeatureSettings: "normal",
    fontKerning: "auto",
    fontOpticalSizing: "auto",
    fontVariationSettings: "normal",
    hyphens: "manual",
    letterSpacing: "normal",
    lineBreak: "auto",
    lineClamp: active ? String(limit) : undefined,
    lineHeight: "inherit",
    maxHeight: active ? `${limit}lh` : undefined,
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
    WebkitBoxOrient: active ? "vertical" : undefined,
    WebkitLineClamp: active ? String(limit) : undefined,
  };
});

watch(
  [() => font, () => text],
  ([currentFont, currentText]) => {
    const request = ++fontRequest;
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!fonts || fonts.check(currentFont, currentText || " ")) {
      fontReady.value = true;
      return;
    }

    fontReady.value = false;
    const complete = () => {
      if (request === fontRequest) fontReady.value = true;
    };
    void fonts.load(currentFont, currentText || " ").then(complete, complete);
  },
  { immediate: true },
);

watchPostEffect((onCleanup) => {
  const body = bodyRef.value;
  if (!body || expanded.value || text.length === 0 || lineLimit.value === undefined) {
    width.value = null;
    return;
  }

  const stop = observeContentBox(body, (entry) => {
    const nextWidth = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
    if (nextWidth !== width.value) width.value = nextWidth;
  });

  onCleanup(stop);
});

watch(
  result,
  (current) => {
    if (current === null) return;

    const changed = !hasResolved || current.clamped !== isClamped.value;
    hasResolved = true;
    isClamped.value = current.clamped;
    if (changed) emit("clampchange", current.clamped);
  },
  { flush: "post", immediate: true },
);

function render(): VNodeChild {
  const current = result.value;
  const renderedText = current?.text ?? text;
  const sourceIsHidden = current?.clamped === true && renderedText !== text;
  const visible = h(
    "span",
    { "aria-hidden": trueOrUndefined(sourceIsHidden), key: "visible" },
    renderedText,
  );
  const children = sourceIsHidden
    ? [h("span", { key: "source", style: visuallyHiddenTextStyle }, text), visible]
    : visible;

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      style: rootStyle,
    }),
    h(
      "span",
      {
        "data-part": "body",
        ref: bodyRef,
        style: bodyStyle.value,
      },
      children,
    ),
  );
}

defineRender(render);

defineExpose({
  ...controls,
  get clamped() {
    return isClamped.value;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies LineClampExposed);
</script>
