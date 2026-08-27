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
  inlineSize,
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
const visibleRef = shallowRef<HTMLElement | null>(null);
const visibleText = shallowRef({ text });
const clamped = shallowRef<boolean | null>(null);
const sourceHidden = shallowRef(false);
const lineLimit = computed(() => normalizeLineLimit(maxLines));
const prepared = computed(() => prepareLineClamp(text, font));
let observedWidth: number | null = null;

function resolve(): void {
  const limit = lineLimit.value;
  if (expanded.value || text.length === 0 || limit === undefined) {
    applyResult({ clamped: false, text });
    return;
  }

  const availableWidth = inlineSize ?? observedWidth;
  if (availableWidth === null) return;

  applyResult(clampPreparedLine(prepared.value, availableWidth, limit));
}

function applyResult(result: ReturnType<typeof clampPreparedLine>): void {
  const nextSourceHidden = result.clamped && result.text !== text;
  const currentText = visibleText.value;

  if (sourceHidden.value !== nextSourceHidden) {
    visibleText.value = { text: result.text };
  } else if (currentText.text !== result.text) {
    // Vue still owns source/visible structure changes; a stable prefix node can
    // be updated in the shared observer batch without another component patch.
    const textNode = visibleRef.value?.firstChild;
    if (textNode?.nodeType === 3) textNode.nodeValue = result.text;
    currentText.text = result.text;
  }

  sourceHidden.value = nextSourceHidden;
  clamped.value = result.clamped;
}

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

watchPostEffect((onCleanup) => {
  const body = bodyRef.value;
  if (
    !body ||
    inlineSize !== undefined ||
    expanded.value ||
    text.length === 0 ||
    lineLimit.value === undefined
  ) {
    observedWidth = null;
    return;
  }

  const stop = observeContentBox(body, (entry) => {
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

watch([expanded, lineLimit, () => font, () => inlineSize, () => text], resolve, {
  immediate: true,
});

function render(): VNodeChild {
  const sourceIsHidden = sourceHidden.value;
  const visible = h(
    "span",
    {
      "aria-hidden": trueOrUndefined(sourceIsHidden),
      key: "visible",
      ref: visibleRef,
    },
    [visibleText.value.text],
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
    return clamped.value === true;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies LineClampExposed);
</script>
