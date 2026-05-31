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
import { trueOrUndefined } from "../attributes.ts";
import {
  borderBoxObserverOptions,
  borderBoxSizeSignature,
  createCoalescingRunner,
  hasBorderBoxEntrySignatureChange,
  listenForFontLoads,
} from "../layout.ts";
import { visuallyHiddenTextStyle } from "../styles.ts";
import {
  canSkipFullTextFit,
  clampTextToFit,
  normalizeLocationRatio,
  prepareText,
  withTextClampMetrics,
} from "../text.ts";
import { inlineClampRootStyle } from "./styles.ts";

import type { InlineClampProps } from "./types.ts";
import type { PreparedText, TextClampResult } from "../text.ts";

const fitTolerance = 0.5;
const contentIndependentWidth = /^(?:-?(?:\d|\.\d)|calc\(|clamp\(|max\(|min\()/u;

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
// Search writes the final candidate into the live body node; this snapshot
// only triggers Vue when the accessibility structure must change.
const visibleBody = shallowRef({ text: parts.value.body });
const isRewritten = computed(() => visibleBody.value.text !== parts.value.body);

let resizeObserver: ResizeObserver | null = null;
let stopFonts = () => {};
let lastLayoutSignature: string | null = null;
let lastTextClamp: TextClampResult | null = null;
let lastParentSizeSignature = "0x0";
let lastRootSizeSignature = "0x0";

function layoutSignature(): string {
  // The parent controls available inline width while the root records the
  // rendered result; observing both catches shrink and grow transitions.
  lastParentSizeSignature = borderBoxSizeSignature(rootRef.value?.parentElement ?? null);
  lastRootSizeSignature = borderBoxSizeSignature(rootRef.value);

  return lastParentSizeSignature + "|" + lastRootSizeSignature;
}

function lastObservedSignature(element: Element): string | null {
  const rootElement = rootRef.value;

  if (element === rootElement?.parentElement) {
    return lastParentSizeSignature;
  }

  if (element === rootElement) {
    return lastRootSizeSignature;
  }

  return null;
}

function clampBody(): string | null {
  const rootElement = rootRef.value;
  const bodyElement = bodyRef.value;
  const body = parts.value.body;

  if (!rootElement || !bodyElement) {
    return body;
  }

  let currentBody = bodyElement.textContent ?? "";

  function applyBodyText(nextBody: string): void {
    if (nextBody !== currentBody) {
      bodyElement.textContent = nextBody;
      currentBody = nextBody;
    }
  }

  const canMeasureCurrentWidth = currentBody !== body && canTrustCurrentRootWidth(rootElement);
  if (!canMeasureCurrentWidth) {
    // Content-sized inline-blocks need the full body before measurement.
    // Otherwise a shortened previous result becomes the stale width limit.
    applyBodyText(body);
  }

  const limit = rootElement.getBoundingClientRect().width;

  if (limit <= 0) {
    // Do not replace visible text with a zero-width guess during mount or hidden
    // layout states.
    applyBodyText(body);
    return null;
  }

  const fitsCurrentBody = () => rootElement.scrollWidth <= limit + fitTolerance;
  const prepared = preparedBody.value;
  const skipFullFit = canSkipFullBodyFit(prepared, limit);

  if (!skipFullFit) {
    applyBodyText(body);

    if (fitsCurrentBody()) {
      // Store the full body as the next warm-start point so a following shrink
      // starts from the real upper bound.
      lastTextClamp = withTextClampMetrics(
        {
          boundaryOffsets: prepared.boundaryOffsets,
          kept: prepared.boundaryOffsets.length - 1,
          text: body,
        },
        lastTextClamp,
        limit,
        1,
      );
      return body;
    }
  }

  const nextResult = clampTextToFit({
    ellipsis,
    fits(candidate) {
      applyBodyText(candidate);
      return fitsCurrentBody();
    },
    hint: lastTextClamp,
    includeFullCandidate: skipFullFit,
    prepared,
    ratio: normalizeLocationRatio(location),
    // Split affixes already own the outer spacing; preserve spaces at the body
    // edges so custom split functions keep browser-like inline flow.
    spacing: "preserve-outer",
  });
  const nextBody = nextResult.text;
  applyBodyText(nextBody);
  lastTextClamp = withTextClampMetrics(nextResult, lastTextClamp, limit, 1);

  return nextBody;
}

function canTrustCurrentRootWidth(element: HTMLElement): boolean {
  return contentIndependentWidth.test(element.style.width.trim());
}

function canSkipFullBodyFit(prepared: PreparedText, rootWidth: number): boolean {
  return canSkipFullTextFit(prepared, lastTextClamp, rootWidth, 1);
}

function applyVisibleBody(nextBody: string): void {
  const body = parts.value.body;
  const sourceHiddenChanged = (visibleBody.value.text !== body) !== (nextBody !== body);

  if (sourceHiddenChanged) {
    visibleBody.value = { text: nextBody };
  } else {
    visibleBody.value.text = nextBody;
  }
}

const requestRecompute = createCoalescingRunner(async () => {
  const nextBody = clampBody();

  if (nextBody !== null && visibleBody.value.text !== nextBody) {
    applyVisibleBody(nextBody);
  }

  lastLayoutSignature = layoutSignature();
});

watch(
  [parts, () => ellipsis, () => location, () => boundary],
  () => {
    // A split or semantic prop change means the previous boundary hint may
    // refer to a different body string.
    lastTextClamp = null;
    visibleBody.value = { text: parts.value.body };
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

  resizeObserver ??= new ResizeObserver((entries) => {
    if (hasBorderBoxEntrySignatureChange(entries, lastObservedSignature)) {
      // Width-only changes are the hot path, so recompute only when the coarse
      // dimensions actually changed.
      requestRecompute();
    }
  });

  for (const element of observed) {
    resizeObserver.observe(element, borderBoxObserverOptions);
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

    <span v-if="parts.start" :aria-hidden="trueOrUndefined(isRewritten)" data-part="start">
      {{ parts.start }}
    </span>

    <span ref="body" :aria-hidden="trueOrUndefined(isRewritten)" data-part="body">
      {{ visibleBody.text }}
    </span>

    <span v-if="parts.end" :aria-hidden="trueOrUndefined(isRewritten)" data-part="end">
      {{ parts.end }}
    </span>
  </component>
</template>
