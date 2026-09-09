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
  emptyBorderBoxSignature,
  hasBorderBoxEntrySignatureChange,
  isContentIndependentWidth,
  listenForFontLoads,
  textLayoutMetricKey,
  observeMeasuredBorderBoxSizes,
} from "../layout.ts";
import { nativeTextStyle, resolveNativeMode } from "../native.ts";
import { warmSearchLocalCoverage } from "../search.ts";
import { visuallyHiddenTextStyle } from "../styles.ts";
import {
  canSkipFullTextFit,
  shouldRecheckFullTextFit,
  fallbackSearchPrepared,
  displayTextForKeptCount,
  searchTextCandidates,
  matchingTextClampHint,
  fullTextClampResult,
  nextClampedMaxWidth,
  normalizeLocationRatio,
  prepareSharedText,
  setElementText,
} from "../text.ts";
import { inlineClampRootStyle } from "./styles.ts";
import { hasExplicitTextWidth, measureLayout } from "../measure.ts";

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
const preparedBody = computed(() => prepareSharedText(parts.value.body, boundary));
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
let lastTextMetricKey: string | null = null;
// Repeated large jumps may start from an exact historical rank, but the rank is
// only a search hint: the current browser layout still validates every result.
// Keep no rendered strings or authoritative answers in this small history.
const textSearchHints = new Map<number, HistoricalTextHint>();
let lastParentSizeSignature = emptyBorderBoxSignature;
let lastRootSizeSignature = emptyBorderBoxSignature;
let pendingFreshLayoutSignature: string | undefined;
let pendingFreshRootWidth: number | undefined;
let disposed = false;
let measurementPending = false;
let measuredLayoutSignature: string | undefined;

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

function* clampBody(): Generator<() => number, string | null, number> {
  const freshRootWidth = pendingFreshRootWidth;
  measuredLayoutSignature = pendingFreshLayoutSignature;
  pendingFreshRootWidth = undefined;
  pendingFreshLayoutSignature = undefined;
  if (disposed || !hasActiveClamp.value) {
    return null;
  }
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

  const limit = yield () => {
    if (split === undefined) {
      const key = textLayoutMetricKey(getComputedStyle(bodyElement));
      if (lastTextMetricKey !== null && lastTextMetricKey !== key) {
        lastTextClamp = null;
        textSearchHints.clear();
      }
      lastTextMetricKey = key;
    }
    return canMeasureCurrentWidth && freshRootWidth !== undefined
      ? freshRootWidth
      : rootElement.getBoundingClientRect().width;
  };

  if (limit <= 0) {
    // Do not replace visible text with a zero-width guess during mount or hidden
    // layout states.
    applyBodyText(body);
    return null;
  }

  let measuredScrollWidth = 0;
  function* fitsCurrentBody(): Generator<() => number, boolean, number> {
    measuredScrollWidth = yield () => rootElement!.scrollWidth;
    return measuredScrollWidth <= limit + fitTolerance;
  }
  const historicalHint = textSearchHints.get(limit) ?? null;
  const currentHint = matchingTextClampHint(prepared, lastTextClamp, context);
  const searchPrepared =
    split === undefined ? fallbackSearchPrepared(prepared, currentHint) : prepared;
  let textHint =
    currentHint !== null &&
    historicalHint !== null &&
    historicalHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
    historicalHint.kept < searchPrepared.boundaryOffsets.length - 1 &&
    split === undefined &&
    (historicalHint.boundaryOffsets !== currentHint.boundaryOffsets ||
      Math.abs(historicalHint.kept - currentHint.kept) > warmSearchLocalCoverage())
      ? { ...historicalHint, ...context, rootWidth: limit }
      : currentHint;
  // Historical ranks choose a pivot; only the latest compatible layout carries
  // the width observation used to decide whether full text must be measured.
  const skipFullFit =
    split === undefined && canSkipFullTextFit(prepared, currentHint, limit, context);
  let searchAnchor: number | undefined;
  let searchAnchorFits: boolean | undefined;

  if (!skipFullFit) {
    if (
      currentHint &&
      !currentHint.fullPrepared &&
      currentHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
      currentHint.kept < searchPrepared.boundaryOffsets.length - 1 &&
      currentBody ===
        displayTextForKeptCount(
          searchPrepared,
          locationRatio,
          ellipsis,
          currentHint.kept,
          "preserve-outer",
        ) &&
      !prepared.hasCursiveText &&
      !/[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}]/u.test(ellipsis)
    ) {
      searchAnchor = currentHint.kept;
      searchAnchorFits = yield* fitsCurrentBody();
    }
    applyBodyText(body);

    if (yield* fitsCurrentBody()) {
      // Store the full body as the next warm-start point so a following shrink
      // starts from the real upper bound.
      lastTextClamp = fullTextClampResult(prepared, limit, context);
      rememberTextSearchHint(limit, lastTextClamp);
      return body;
    }

    const boundaryCount = prepared.boundaryOffsets.length - 1;
    const coldBoundaryOffsets =
      boundaryCount <= 16 && prepared.fallbackBoundaryOffsets
        ? prepared.fallbackBoundaryOffsets
        : prepared.boundaryOffsets;
    const coldBoundaryCount = coldBoundaryOffsets.length - 1;
    if (
      (textHint === null || textHint.boundaryOffsets !== prepared.boundaryOffsets) &&
      coldBoundaryCount > 16
    ) {
      // A fallback rank is only a pivot. Prefer the current density already
      // measured with the full body before consulting its historical cut.
      // A failed full-body read carries more information than a boolean: for a
      // split line, measure the full body once to exclude fixed affix occupancy.
      // It remains only a hint; the normal measured search proves the result.
      const fullBodyWidth = split
        ? yield () => bodyElement.getBoundingClientRect().width
        : measuredScrollWidth;
      const availableBodyWidth = limit - (measuredScrollWidth - fullBodyWidth);
      const fitRatio = fullBodyWidth > 0 ? Math.max(0, availableBodyWidth / fullBodyWidth) : 0;
      textHint = {
        boundaryOffsets: coldBoundaryOffsets,
        ...context,
        kept: Math.min(coldBoundaryCount - 1, Math.floor(coldBoundaryCount * fitRatio)),
      };
    }
  }

  if (
    textHint &&
    !textHint.fullPrepared &&
    textHint.rootWidth !== undefined &&
    textHint.rootWidth > 0 &&
    textHint.rootWidth !== limit
  ) {
    const previousKept = textHint.kept;
    textHint = {
      ...textHint,
      kept: Math.max(
        0,
        Math.min(
          textHint.boundaryOffsets.length - 2,
          Math.ceil((textHint.kept * limit) / textHint.rootWidth),
        ),
      ),
    };
    if (
      skipFullFit &&
      textHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
      previousKept < searchPrepared.boundaryOffsets.length - 1 &&
      previousKept !== textHint.kept &&
      currentBody ===
        displayTextForKeptCount(
          searchPrepared,
          locationRatio,
          ellipsis,
          previousKept,
          "preserve-outer",
        )
    ) {
      searchAnchor = previousKept;
    }
  }

  const search = searchTextCandidates({
    anchor: searchAnchor,
    anchorFits: searchAnchorFits,
    ellipsis,
    hint: textHint,
    prepared: searchPrepared,
    ratio: locationRatio,
    // Split affixes already own the outer spacing; preserve spaces at the body
    // edges so custom split functions keep browser-like inline flow.
    spacing: "preserve-outer",
  });
  let step = search.next();
  while (!step.done) {
    applyBodyText(step.value);
    step = search.next(yield* fitsCurrentBody());
  }
  const nextResult = step.value;
  const nextBody = nextResult.text;
  let metricHint = currentHint?.boundaryOffsets === nextResult.boundaryOffsets ? currentHint : null;
  if (skipFullFit && shouldRecheckFullTextFit(currentHint, nextResult, limit)) {
    applyBodyText(body);
    if (yield* fitsCurrentBody()) {
      lastTextClamp = fullTextClampResult(prepared, limit, context);
      rememberTextSearchHint(limit, lastTextClamp);
      return body;
    }
    metricHint = null;
  }
  applyBodyText(nextBody);
  lastTextClamp = {
    ...nextResult,
    ...context,
    ...nextClampedMaxWidth(
      metricHint,
      nextResult.kept,
      limit,
      nextResult.boundaryOffsets.length - 1,
    ),
    rootWidth: limit,
  };
  rememberTextSearchHint(limit, lastTextClamp);
  return nextBody;
}

function rememberTextSearchHint(width: number, result: TextClampResult): void {
  textSearchHints.delete(width);
  // Full results cannot seed a historical cut. Avoid forcing their lazy rank.
  if (result.fullPrepared) return;
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

  if (measurementPending || disposed) {
    return;
  }
  measurementPending = true;
  void measureLayout(
    clampBody(),
    () => !disposed,
    (nextBody) => {
      measurementPending = false;
      if (!hasActiveClamp.value) {
        lastTextClamp = null;
        textSearchHints.clear();
        lastLayoutSignature = null;
        visibleBody.value = { text: parts.value.body };
        return;
      }
      if (nextBody !== null && visibleBody.value.text !== nextBody) {
        applyVisibleBody(nextBody);
      }
      lastLayoutSignature =
        measuredLayoutSignature !== undefined &&
        rootRef.value &&
        canTrustCurrentRootWidth(rootRef.value)
          ? measuredLayoutSignature
          : layoutSnapshot().signature;
    },
    // An empty candidate can toggle :empty / :has() styles on other clamps.
    ellipsis.length > 0 && rootRef.value !== null && hasExplicitTextWidth(rootRef.value),
  ).catch((error: unknown) => {
    measurementPending = false;
    throw error;
  });
}

watch(
  [parts, () => ellipsis, () => location, () => boundary],
  () => {
    // A split or semantic prop change means the previous boundary hint may
    // refer to a different body string.
    lastTextClamp = null;
    textSearchHints.clear();
    if (usesNativeClamp.value) {
      visibleBody.value = { text: parts.value.body };
    } else {
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

  stopFonts = listenForFontLoads(() => {
    lastTextClamp = null;
    textSearchHints.clear();
    requestRecompute();
  });

  const stopObserving = observeMeasuredBorderBoxSizes(observed, (entries) => {
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
  disposed = true;
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
