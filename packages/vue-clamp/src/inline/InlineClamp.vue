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
  borderBoxSizeSnapshot,
  borderBoxSizeSignature,
  createCoalescingRunner,
  emptyBorderBoxSignature,
  hasBorderBoxEntrySignatureChange,
  isContentIndependentWidth,
  listenForFontLoads,
  observeBorderBoxSizes,
} from "../layout.ts";
import { nativeTextStyle, resolveNativeMode } from "../native.ts";
import { shouldVerifyFullCandidate, warmSearchLocalCoverage } from "../search.ts";
import { visuallyHiddenTextStyle } from "../styles.ts";
import {
  canSkipFullTextFit,
  clampTextToFit,
  matchingTextClampHint,
  nextClampedMaxWidth,
  normalizeLocationRatio,
  prepareText,
  setElementText,
} from "../text.ts";
import { inlineClampRootStyle } from "./styles.ts";

import type { InlineClampProps } from "./types.ts";
import type { TextClampContext, TextClampHint, TextClampResult } from "../text.ts";
type LayoutSnapshot = {
  readonly rootWidth: number;
  readonly signature: string;
};
type HistoricalTextHint = Pick<TextClampHint, "boundaryOffsets" | "kept">;

const fitTolerance = 0.5;
const maxTextSearchHints = 8;

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
const usesNativeClamp = computed(
  () =>
    split === undefined &&
    resolveNativeMode({
      boundary,
      ellipsis,
      expanded: false,
      hasAfterSlot: false,
      lineLimit: 1,
      locationRatio: normalizeLocationRatio(location),
      maxHeight: undefined,
    }) === "single-line",
);
const hasActiveClamp = computed(() => !usesNativeClamp.value && parts.value.body.length > 0);
// Search writes the final candidate into the live body node; this snapshot
// only triggers Vue when the accessibility structure must change.
const visibleBody = shallowRef({ text: parts.value.body });
const isRewritten = computed(
  () => !usesNativeClamp.value && visibleBody.value.text !== parts.value.body,
);

let stopFonts = () => {};
let lastLayoutSignature: string | null = null;
let lastTextClamp: TextClampResult | null = null;
// Repeated large jumps may start from an exact historical rank, but the rank is
// only a search hint: the current browser layout still validates every result.
// Keep no rendered strings or authoritative answers in this small history.
const textSearchHints = new Map<number, HistoricalTextHint>();
let lastParentSizeSignature = emptyBorderBoxSignature;
let lastRootSizeSignature = emptyBorderBoxSignature;
let pendingFreshLayoutSignature: string | undefined;
let pendingFreshRootWidth: number | undefined;

function layoutSnapshot(): LayoutSnapshot {
  // The parent controls available inline width while the root records the
  // rendered result; observing both catches shrink and grow transitions.
  lastParentSizeSignature = borderBoxSizeSignature(rootRef.value?.parentElement ?? null);
  const rootSnapshot = borderBoxSizeSnapshot(rootRef.value);
  lastRootSizeSignature = rootSnapshot.signature;

  return {
    rootWidth: rootSnapshot.width,
    signature: lastParentSizeSignature + "|" + lastRootSizeSignature,
  };
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

function clampBody(freshRootWidth?: number): string | null {
  const rootElement = rootRef.value;
  const bodyElement = bodyRef.value;
  const body = parts.value.body;

  if (!rootElement || !bodyElement) {
    return body;
  }

  let currentBody = bodyElement.textContent ?? "";

  function applyBodyText(nextBody: string): void {
    if (nextBody !== currentBody) {
      setElementText(bodyElement, nextBody);
      currentBody = nextBody;
    }
  }

  const canMeasureCurrentWidth = currentBody !== body && canTrustCurrentRootWidth(rootElement);
  const prepared = preparedBody.value;
  const locationRatio = normalizeLocationRatio(location);
  const context: TextClampContext = {
    ellipsis,
    hasAffixes: false,
    lineCapacity: 1,
    lineLimit: undefined,
    maxHeight: undefined,
    ratio: locationRatio,
    spacing: "preserve-outer",
  };

  if (!canMeasureCurrentWidth) {
    // Content-sized inline-blocks need the full body before measurement.
    // Otherwise a shortened previous result becomes the stale width limit.
    applyBodyText(body);
  }

  const limit =
    canMeasureCurrentWidth && freshRootWidth !== undefined
      ? freshRootWidth
      : rootElement.getBoundingClientRect().width;

  if (limit <= 0) {
    // Do not replace visible text with a zero-width guess during mount or hidden
    // layout states.
    applyBodyText(body);
    return null;
  }

  let measuredScrollWidth = 0;
  const fitsCurrentBody = () => {
    measuredScrollWidth = rootElement.scrollWidth;
    return measuredScrollWidth <= limit + fitTolerance;
  };
  const boundaryCount = prepared.boundaryOffsets.length - 1;
  const historicalHint = textSearchHints.get(limit) ?? null;
  const currentHint = matchingTextClampHint(prepared, lastTextClamp, context);
  let textHint =
    historicalHint?.boundaryOffsets === prepared.boundaryOffsets &&
    historicalHint.kept < boundaryCount &&
    split === undefined &&
    currentHint !== null &&
    Math.abs(historicalHint.kept - currentHint.kept) > warmSearchLocalCoverage()
      ? { ...historicalHint, ...context, rootWidth: limit }
      : currentHint;
  const skipFullFit = canSkipFullTextFit(prepared, textHint, limit, context);

  if (!skipFullFit) {
    applyBodyText(body);

    if (fitsCurrentBody()) {
      // Store the full body as the next warm-start point so a following shrink
      // starts from the real upper bound.
      lastTextClamp = {
        boundaryOffsets: prepared.boundaryOffsets,
        ...context,
        kept: boundaryCount,
        rootWidth: limit,
        text: body,
      };
      rememberTextSearchHint(limit, lastTextClamp);
      return body;
    }

    const coldBoundaryOffsets =
      prepared.fallbackBoundaryOffsets && boundaryCount <= 16
        ? prepared.fallbackBoundaryOffsets
        : prepared.boundaryOffsets;
    const coldBoundaryCount = coldBoundaryOffsets.length - 1;
    if (textHint === null && split === undefined && coldBoundaryCount > 16) {
      // A failed full-body read carries more information than a boolean: for a
      // single line, the available/full width ratio is a useful first rank.
      // It remains only a hint; the normal measured search proves the result.
      textHint = {
        boundaryOffsets: coldBoundaryOffsets,
        ...context,
        kept: Math.min(
          coldBoundaryCount - 1,
          Math.max(0, Math.floor((coldBoundaryCount * limit) / measuredScrollWidth)),
        ),
      };
    }
  }

  const nextResult = clampTextToFit({
    ellipsis,
    fits(candidate) {
      applyBodyText(candidate);
      return fitsCurrentBody();
    },
    hint: textHint,
    includeFullCandidate: skipFullFit,
    prepared,
    ratio: locationRatio,
    // Split affixes already own the outer spacing; preserve spaces at the body
    // edges so custom split functions keep browser-like inline flow.
    spacing: "preserve-outer",
    verifyFullCandidate: shouldVerifyFullCandidate(
      skipFullFit,
      limit,
      textHint?.rootWidth,
      (textHint?.kept ?? 0) >= boundaryCount,
      textHint?.clampedMaxWidth,
    ),
  });
  const nextBody = nextResult.text;
  applyBodyText(nextBody);
  lastTextClamp = {
    ...nextResult,
    ...context,
    ...nextClampedMaxWidth(textHint, nextResult.kept, limit, boundaryCount),
    rootWidth: limit,
  };
  rememberTextSearchHint(limit, lastTextClamp);
  return nextBody;
}

function rememberTextSearchHint(width: number, result: TextClampResult): void {
  textSearchHints.delete(width);
  textSearchHints.set(width, {
    boundaryOffsets: result.boundaryOffsets,
    kept: result.kept,
  });

  if (textSearchHints.size > maxTextSearchHints) {
    textSearchHints.delete(textSearchHints.keys().next().value!);
  }
}

function canTrustCurrentRootWidth(element: HTMLElement): boolean {
  return isContentIndependentWidth(element.style.width.trim());
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

function requestRecompute(snapshot?: LayoutSnapshot): void {
  if (snapshot) {
    pendingFreshLayoutSignature = snapshot.signature;
    pendingFreshRootWidth = snapshot.rootWidth;
  } else {
    pendingFreshLayoutSignature = undefined;
    pendingFreshRootWidth = undefined;
  }

  requestRecomputeRunner();
}

const requestRecomputeRunner = createCoalescingRunner(async () => {
  const freshLayoutSignature = pendingFreshLayoutSignature;
  const freshRootWidth = pendingFreshRootWidth;
  pendingFreshLayoutSignature = undefined;
  pendingFreshRootWidth = undefined;

  if (!hasActiveClamp.value) {
    lastTextClamp = null;
    textSearchHints.clear();
    lastLayoutSignature = null;
    visibleBody.value = { text: parts.value.body };
    return;
  }

  const nextBody = clampBody(freshRootWidth);

  if (nextBody !== null && visibleBody.value.text !== nextBody) {
    applyVisibleBody(nextBody);
  }

  lastLayoutSignature =
    freshLayoutSignature !== undefined && rootRef.value && canTrustCurrentRootWidth(rootRef.value)
      ? freshLayoutSignature
      : layoutSnapshot().signature;
});

watch(
  [parts, () => ellipsis, () => location, () => boundary],
  () => {
    // A split or semantic prop change means the previous boundary hint may
    // refer to a different body string.
    lastTextClamp = null;
    textSearchHints.clear();
    visibleBody.value = { text: parts.value.body };
    if (!usesNativeClamp.value) {
      requestRecompute();
    }
  },
  { flush: "post" },
);

watchPostEffect((onCleanup) => {
  const rootElement = rootRef.value;

  if (!rootElement || !hasActiveClamp.value) {
    return;
  }

  const observed = [rootElement.parentElement, rootElement].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );

  stopFonts = listenForFontLoads(() => requestRecompute());

  const stopObserving = observeBorderBoxSizes(observed, (entries) => {
    if (hasBorderBoxEntrySignatureChange(entries, lastObservedSignature)) {
      // Width-only changes are the hot path, so recompute only when the coarse
      // dimensions actually changed.
      requestRecompute();
    }
  });

  onCleanup(() => {
    stopFonts();
    stopFonts = () => {};
    stopObserving();
  });
});

onMounted(() => {
  if (hasActiveClamp.value) {
    requestRecompute();
  }
});

onUpdated(() => {
  if (!hasActiveClamp.value) {
    return;
  }

  const snapshot = layoutSnapshot();
  if (snapshot.signature !== lastLayoutSignature) {
    // Vue-driven style changes can happen before ResizeObserver delivery; keep
    // the final clamped text in the same update cycle.
    requestRecompute(snapshot);
  }
});

onBeforeUnmount(() => {
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

    <span
      ref="body"
      :aria-hidden="trueOrUndefined(isRewritten)"
      data-part="body"
      :style="usesNativeClamp ? nativeTextStyle : undefined"
    >
      {{ usesNativeClamp ? parts.body : visibleBody.text }}
    </span>

    <span v-if="parts.end" :aria-hidden="trueOrUndefined(isRewritten)" data-part="end">
      {{ parts.end }}
    </span>
  </component>
</template>
