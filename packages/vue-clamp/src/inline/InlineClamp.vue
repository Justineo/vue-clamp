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
  exactResultCacheEntryLimit,
  rememberCacheEntry,
  touchCacheEntry,
  tupleCacheKey,
} from "../cache.ts";
import {
  borderBoxObserverOptions,
  borderBoxSizeSnapshot,
  borderBoxSizeSignature,
  createCoalescingRunner,
  emptyBorderBoxSignature,
  hasBorderBoxEntrySignatureChange,
  hasInlineFontMetrics,
  hasUnresolvedInlineTextWidthStyle,
  isContentIndependentWidth,
  listenForFontLoads,
} from "../layout.ts";
import { visuallyHiddenTextStyle } from "../styles.ts";
import {
  canSkipFullTextFit,
  clampTextToFit,
  normalizeLocationRatio,
  prepareText,
  setElementText,
} from "../text.ts";
import { inlineClampRootStyle } from "./styles.ts";

import type { InlineClampProps } from "./types.ts";
import type { PreparedText, TextClampResult } from "../text.ts";

type TextContext = {
  readonly ellipsis: string;
  readonly hasAffixes: false;
  readonly lineCapacity: 1;
  readonly lineLimit: undefined;
  readonly maxHeight: undefined;
  readonly ratio: number;
  readonly spacing: "preserve-outer";
};
type LayoutSnapshot = {
  readonly rootWidth: number;
  readonly signature: string;
};

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
// Search writes the final candidate into the live body node; this snapshot
// only triggers Vue when the accessibility structure must change.
const visibleBody = shallowRef({ text: parts.value.body });
const isRewritten = computed(() => visibleBody.value.text !== parts.value.body);

let resizeObserver: ResizeObserver | null = null;
let stopFonts = () => {};
let lastLayoutSignature: string | null = null;
let lastTextClamp: TextClampResult | null = null;
const resultCache = new Map<string, TextClampResult>();
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

function clampBody(freshRootWidth?: number, cacheKey?: string): string | null {
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
  const context = textContextFor(locationRatio);

  if (cacheKey !== undefined) {
    const cached = matchingCachedResult(cacheKey, prepared, context);
    if (cached) {
      applyBodyText(cached.text);
      lastTextClamp = cached;
      return cached.text;
    }
  }

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

  const fitsCurrentBody = () => rootElement.scrollWidth <= limit + fitTolerance;
  const textHint = matchingTextHint(prepared, context);
  const boundaryCount = prepared.boundaryOffsets.length - 1;
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
      rememberCacheEntry(resultCache, cacheKey, lastTextClamp, exactResultCacheEntryLimit);
      return body;
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
    verifyFullCandidate: shouldVerifyFullBodyCandidate(skipFullFit, textHint, limit, boundaryCount),
  });
  const nextBody = nextResult.text;
  applyBodyText(nextBody);
  lastTextClamp = {
    ...nextResult,
    ...context,
    ...nextClampedMaxWidth(nextResult, textHint, limit, boundaryCount),
    rootWidth: limit,
  };
  rememberCacheEntry(resultCache, cacheKey, lastTextClamp, exactResultCacheEntryLimit);

  return nextBody;
}

function canTrustCurrentRootWidth(element: HTMLElement): boolean {
  return isContentIndependentWidth(element.style.width.trim());
}

function resultCacheKey(freshLayoutSignature: string | undefined): string | undefined {
  const element = rootRef.value;
  if (freshLayoutSignature === undefined || !element || !canCacheResult(element)) {
    return undefined;
  }

  return tupleCacheKey([
    freshLayoutSignature,
    element.getAttribute("class") ?? "",
    element.getAttribute("style") ?? "",
  ]);
}

function canCacheResult(element: HTMLElement): boolean {
  if (
    !canTrustCurrentRootWidth(element) ||
    (element.getAttribute("class") ?? "").trim() !== "" ||
    hasUnresolvedInlineTextWidthStyle(element.style)
  ) {
    return false;
  }

  return hasInlineFontMetrics(element.style);
}

function textContextFor(ratio: number): TextContext {
  return {
    ellipsis,
    hasAffixes: false,
    lineCapacity: 1,
    lineLimit: undefined,
    maxHeight: undefined,
    ratio,
    spacing: "preserve-outer",
  };
}

function matchingTextHint(prepared: PreparedText, context: TextContext): TextClampResult | null {
  const hint = lastTextClamp;

  return sameTextContext(hint, prepared, context) ? hint : null;
}

function sameTextContext(
  result: TextClampResult | null,
  prepared: PreparedText,
  context: TextContext,
): boolean {
  if (!result) {
    return false;
  }

  return (
    result.boundaryOffsets === prepared.boundaryOffsets &&
    result.ellipsis === context.ellipsis &&
    (result.hasAffixes ?? false) === context.hasAffixes &&
    result.lineCapacity === context.lineCapacity &&
    result.lineLimit === context.lineLimit &&
    result.maxHeight === context.maxHeight &&
    result.ratio === context.ratio &&
    result.spacing === context.spacing
  );
}

function matchingCachedResult(
  key: string,
  prepared: PreparedText,
  context: TextContext,
): TextClampResult | null {
  const result = resultCache.get(key) ?? null;
  if (!sameTextContext(result, prepared, context)) {
    return null;
  }

  return touchCacheEntry(resultCache, key) ?? null;
}

function nextClampedMaxWidth(
  result: TextClampResult,
  hint: TextClampResult | null,
  rootWidth: number,
  boundaryCount: number,
): Pick<TextClampResult, "clampedMaxWidth"> {
  if (result.kept >= boundaryCount) {
    return {};
  }

  return {
    clampedMaxWidth: Math.max(rootWidth, hint?.clampedMaxWidth ?? rootWidth),
  };
}

function shouldVerifyFullBodyCandidate(
  skipFullFit: boolean,
  hint: TextClampResult | null,
  rootWidth: number,
  boundaryCount: number,
): boolean {
  if (!skipFullFit || hint?.rootWidth === undefined) {
    return true;
  }

  if (rootWidth <= hint.rootWidth) {
    return rootWidth === hint.rootWidth;
  }

  if (hint.kept >= boundaryCount) {
    return true;
  }

  return hint.clampedMaxWidth === undefined || rootWidth > hint.clampedMaxWidth;
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
    resultCache.clear();
  }

  requestRecomputeRunner();
}

const requestRecomputeRunner = createCoalescingRunner(async () => {
  const freshLayoutSignature = pendingFreshLayoutSignature;
  const freshRootWidth = pendingFreshRootWidth;
  pendingFreshLayoutSignature = undefined;
  pendingFreshRootWidth = undefined;
  const nextBody = clampBody(freshRootWidth, resultCacheKey(freshLayoutSignature));

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
  stopFonts = listenForFontLoads(() => requestRecompute());
});

onUpdated(() => {
  const snapshot = layoutSnapshot();
  if (snapshot.signature !== lastLayoutSignature) {
    // Vue-driven style changes can happen before ResizeObserver delivery; keep
    // the final clamped text in the same update cycle.
    requestRecompute(snapshot);
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
