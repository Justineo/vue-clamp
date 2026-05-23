<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowRef,
  useTemplateRef,
  watch,
  watchPostEffect,
} from "vue";
import { combinedSizeSignature, createCoalescingRunner, listenForFontLoads } from "../layout.ts";
import { visuallyHiddenTextStyle } from "../styles.ts";
import { clampTextToFit, normalizeLocationRatio, prepareText } from "../text.ts";
import { inlineClampRootStyle } from "./styles.ts";

import type { InlineClampProps } from "./types.ts";
import type { TextClampResult } from "../text.ts";

const fitTolerance = 0.5;

defineOptions({
  name: "InlineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "span",
  text,
  ellipsis = "…",
  location = "end",
  boundary = "grapheme",
  split,
} = defineProps<InlineClampProps>();

const rootRef = useTemplateRef<HTMLElement>("root");
const bodyRef = useTemplateRef("body");
const parts = computed(() => split?.(text) ?? { body: text });
const preparedBody = computed(() => prepareText(parts.value.body, boundary));
const locationRatio = computed(() => normalizeLocationRatio(location));
const visibleBody = shallowRef(parts.value.body);
const isRewritten = computed(() => visibleBody.value !== parts.value.body);
const ariaHidden = computed(() => (isRewritten.value ? "true" : undefined));

let resizeObserver: ResizeObserver | null = null;
let stopFonts = () => {};
let lastLayoutSignature: string | null = null;
let lastTextClamp: TextClampResult | null = null;

function layoutSignature(): string {
  // The parent controls available inline width while the root records the
  // rendered result; observing both catches shrink and grow transitions.
  return combinedSizeSignature(rootRef.value?.parentElement ?? null, rootRef.value);
}

function clampBody(): string | null {
  const rootElement = rootRef.value;
  const bodyElement = bodyRef.value;
  const body = parts.value.body;

  if (!rootElement || !bodyElement) {
    return body;
  }

  // Always restore the full body before measuring. Otherwise a previously
  // shortened inline-block could become the stale width limit after growth.
  bodyElement.textContent = body;

  const limit = rootElement.getBoundingClientRect().width;

  if (limit <= 0) {
    // Do not replace visible text with a zero-width guess during mount or hidden
    // layout states.
    return null;
  }

  const fitsCurrentBody = () => rootElement.scrollWidth <= limit + fitTolerance;
  const prepared = preparedBody.value;
  const ratio = locationRatio.value;

  if (fitsCurrentBody()) {
    // Store the full body as the next warm-start point so a following shrink
    // starts from the real upper bound.
    lastTextClamp = {
      boundaryOffsets: prepared.boundaryOffsets,
      kept: prepared.boundaryOffsets.length - 1,
      text: body,
    };
    return body;
  }

  const nextResult = clampTextToFit({
    ellipsis,
    fits(candidate) {
      bodyElement.textContent = candidate;
      return fitsCurrentBody();
    },
    hint: lastTextClamp,
    prepared,
    ratio,
    // Split affixes already own the outer spacing; preserve spaces at the body
    // edges so custom split functions keep browser-like inline flow.
    spacing: "preserve-outer",
  });
  const nextBody = nextResult.text;
  bodyElement.textContent = nextBody;
  lastTextClamp = nextResult;

  return nextBody;
}

const requestRecompute = createCoalescingRunner(async () => {
  const nextBody = clampBody();

  if (nextBody !== null && visibleBody.value !== nextBody) {
    visibleBody.value = nextBody;
  }

  lastLayoutSignature = layoutSignature();
});

watch(
  [parts, () => ellipsis, () => location, () => boundary],
  () => {
    // A split or semantic prop change means the previous boundary hint may
    // refer to a different body string.
    lastTextClamp = null;
    visibleBody.value = parts.value.body;
    requestRecompute();
  },
  { flush: "post" },
);

watchPostEffect((onCleanup) => {
  const rootElement = rootRef.value;

  if (!rootElement) {
    return;
  }

  const observed = [rootElement.parentElement, rootElement].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );

  resizeObserver ??= new ResizeObserver(() => {
    if (layoutSignature() !== lastLayoutSignature) {
      // Width-only changes are the hot path, so recompute only when the coarse
      // dimensions actually changed.
      requestRecompute();
    }
  });

  for (const element of observed) {
    resizeObserver.observe(element);
  }

  onCleanup(() => {
    for (const element of observed) {
      resizeObserver?.unobserve(element);
    }
  });
});

onMounted(() => {
  requestRecompute();
  stopFonts = listenForFontLoads(requestRecompute);
});

onUpdated(() => {
  if (layoutSignature() !== lastLayoutSignature) {
    // Vue-driven style changes can happen before ResizeObserver delivery; keep
    // the final clamped text in the same update cycle.
    requestRecompute();
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopFonts();
});
</script>

<template>
  <component
    :is="rootTag"
    v-bind="$attrs"
    data-part="root"
    ref="root"
    :style="inlineClampRootStyle"
  >
    <span v-if="isRewritten" :style="visuallyHiddenTextStyle">
      {{ text }}
    </span>

    <span v-if="parts.start" :aria-hidden="ariaHidden" data-part="start">
      {{ parts.start }}
    </span>

    <span ref="body" :aria-hidden="ariaHidden" data-part="body">
      {{ visibleBody }}
    </span>

    <span v-if="parts.end" :aria-hidden="ariaHidden" data-part="end">
      {{ parts.end }}
    </span>
  </component>
</template>
