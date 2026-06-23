import { fitsContent } from "./layout.ts";
import {
  defaultWarmExpansionLimit,
  estimateColdSearchMaxProbeCount,
  estimateWarmSearchProbeCount,
  findLastFittingIndex,
  warmSearchLocalCoverage,
} from "./search.ts";

import type { SimpleLineFit, VisibleBoundsCache } from "./layout.ts";
import type { ClampBoundary, ClampLength, LineClampLocation } from "./types.ts";

// Text preparation is separated from DOM measurement so width-only reclamps can
// reuse the same boundary list instead of segmenting the source text again.
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

const wordSegmenter = new Intl.Segmenter(undefined, {
  granularity: "word",
});

export interface PreparedText {
  readonly text: string;
  readonly boundary: ClampBoundary;
  readonly boundaryOffsets: readonly number[];
  readonly fallbackBoundaryOffsets?: readonly number[];
}

export interface TextClampHint {
  readonly boundaryOffsets: readonly number[];
  readonly ellipsis?: string | undefined;
  readonly hasAffixes?: boolean | undefined;
  readonly kept: number;
  readonly lineCapacity?: number | undefined;
  readonly layoutKey?: string | undefined;
  readonly lineLimit?: number | undefined;
  readonly maxHeight?: ClampLength | undefined;
  readonly rankPerPx?: number;
  readonly rankPerPxWidth?: number;
  readonly ratio?: number | undefined;
  readonly clampedMaxWidth?: number;
  readonly rootWidth?: number;
  readonly spacing?: TextClampSpacing | undefined;
  readonly wordFallbackMaxWidth?: number;
}

export interface TextClampResult extends TextClampHint {
  readonly text: string;
}

export function setElementText(element: HTMLElement, text: string): void {
  const child = element.firstChild;

  if (child instanceof Text && child.nextSibling === null) {
    child.data = text;
    return;
  }

  element.textContent = text;
}

type RankSlope = {
  rankPerPx?: number;
  rankPerPxWidth?: number;
};
type WarmSearchInput = {
  readonly boundary: ClampBoundary;
  readonly candidateCount: number;
  readonly hasAffixes: boolean;
  readonly hintKept: number;
  readonly includeFullCandidate: boolean;
  readonly lineCapacity: number | undefined;
  readonly rankPerPx: number;
  readonly referenceWidth: number;
  readonly rootWidth: number;
};
type WarmHintInput = Omit<WarmSearchInput, "hintKept" | "rankPerPx" | "referenceWidth"> & {
  readonly hint: TextClampHint;
};
type WarmSearchEstimate = {
  readonly rankMove: number;
  readonly searchCount: number;
  readonly target: number;
};
export type TextClampSpacing = "trim" | "preserve-outer";

type TextFitContext = {
  readonly ellipsis: string;
  readonly ratio: number;
  readonly spacing: TextClampSpacing;
};

type TextClampContext = TextFitContext & {
  readonly hasAffixes: boolean;
  readonly lineCapacity: number | undefined;
  readonly layoutKey?: string | undefined;
  readonly lineLimit: number | undefined;
  readonly maxHeight: ClampLength | undefined;
};

const maxComparableWidthRatio = 2;
const warmSearchProbeRiskBudget = defaultWarmExpansionLimit;
const wordWarmExpansionLimit = defaultWarmExpansionLimit + 1;

export type TextClampFitInput = {
  readonly ellipsis: string;
  readonly expansionLimit?: number;
  readonly fits: (text: string) => boolean;
  readonly hint?: TextClampHint | null;
  readonly includeFullCandidate?: boolean;
  readonly prepared: PreparedText;
  readonly ratio: number;
  readonly spacing?: TextClampSpacing;
  readonly verifyFullCandidate?: boolean;
};

export type TextClampLayoutInput = {
  readonly content: HTMLElement;
  readonly ellipsis: string;
  readonly hasAffixes?: boolean;
  readonly hint?: TextClampHint | null;
  readonly lineCapacity?: number | undefined;
  readonly layoutKey?: string | undefined;
  readonly lineLimit: number | undefined;
  readonly maxHeight: ClampLength | undefined;
  readonly prepared: PreparedText;
  readonly ratio: number;
  readonly root: HTMLElement;
  readonly rootWidth: number;
  readonly forceSkipFullFit?: boolean;
  readonly simpleLineFit?: SimpleLineFit;
  readonly target: HTMLElement;
};

function isAsciiSafe(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code < 0x20 || code > 0x7e) && code !== 0x09 && code !== 0x0a) {
      return false;
    }
  }

  return true;
}

function graphemeBoundaryOffsets(text: string, asciiSafe = isAsciiSafe(text)): number[] {
  if (asciiSafe) {
    // ASCII has one UTF-16 code unit per grapheme in the range we accept here,
    // so this hot path avoids Intl.Segmenter for common English/code strings.
    const offsets: number[] = [];
    for (let index = 0; index <= text.length; index += 1) {
      offsets.push(index);
    }

    return offsets;
  }

  const boundaryOffsets = [0];
  let offset = 0;

  for (const part of graphemeSegmenter.segment(text)) {
    offset += part.segment.length;
    boundaryOffsets.push(offset);
  }

  return boundaryOffsets;
}

function wordBoundaryOffsets(
  text: string,
  fallbackBoundaryOffsets: readonly number[],
  asciiSafe: boolean,
): number[] {
  const boundaryOffsets = [0];
  let fallbackIndex = 0;

  for (const part of wordSegmenter.segment(text)) {
    const offset = part.index + part.segment.length;
    while (!asciiSafe && (fallbackBoundaryOffsets[fallbackIndex] ?? Infinity) < offset) {
      fallbackIndex += 1;
    }

    // Only keep word boundaries that are also grapheme boundaries. This prevents
    // a word-level cut from landing inside a composed character.
    const isGraphemeBoundary = asciiSafe || fallbackBoundaryOffsets[fallbackIndex] === offset;
    if (isGraphemeBoundary && boundaryOffsets[boundaryOffsets.length - 1] !== offset) {
      boundaryOffsets.push(offset);
    }
  }

  if (boundaryOffsets[boundaryOffsets.length - 1] !== text.length) {
    boundaryOffsets.push(text.length);
  }

  return boundaryOffsets;
}

export function prepareText(text: string, boundary: ClampBoundary = "grapheme"): PreparedText {
  const asciiSafe = isAsciiSafe(text);
  const fallbackBoundaryOffsets = graphemeBoundaryOffsets(text, asciiSafe);

  if (boundary === "grapheme") {
    return {
      text,
      boundary,
      boundaryOffsets: fallbackBoundaryOffsets,
    };
  }

  // Word mode still keeps grapheme fallback metadata because very long words
  // need a last-resort way to fit inside narrow containers.
  return {
    text,
    boundary,
    boundaryOffsets: wordBoundaryOffsets(text, fallbackBoundaryOffsets, asciiSafe),
    fallbackBoundaryOffsets,
  };
}

export function displayTextForKeptCount(
  prepared: PreparedText,
  ratio: number,
  ellipsis: string,
  kept: number,
  spacing: TextClampSpacing = "trim",
): string {
  const { boundaryOffsets, text } = prepared;
  const boundaryCount = boundaryOffsets.length - 1;

  if (kept >= boundaryCount) {
    // Full text candidates must not receive an ellipsis; callers use this branch
    // to detect unclamped output.
    return text;
  }

  // `kept` is split around the normalized location so start/middle/end clamping
  // share the same search over a single candidate count.
  const prefix = Math.floor(kept * ratio);
  const suffix = kept - prefix;

  if (prefix <= 0) {
    const suffixText = text.slice(boundaryOffsets[boundaryCount - suffix]);
    const trimSuffix = spacing === "preserve-outer" ? suffixText.trimStart() : suffixText.trim();

    return `${ellipsis}${trimSuffix}`;
  }

  const prefixText = text.slice(0, boundaryOffsets[prefix]);
  const trimPrefix = spacing === "preserve-outer" ? prefixText.trimEnd() : prefixText.trim();

  if (suffix <= 0) {
    return `${trimPrefix}${ellipsis}`;
  }

  const suffixText = text.slice(boundaryOffsets[boundaryCount - suffix]);
  const trimSuffix = spacing === "preserve-outer" ? suffixText.trimStart() : suffixText.trim();

  return `${trimPrefix}${ellipsis}${trimSuffix}`;
}

export function normalizeLocationRatio(location: LineClampLocation): number {
  if (location === "start") {
    return 0;
  }

  if (location === "middle") {
    return 0.5;
  }

  if (location === "end") {
    return 1;
  }

  return Math.max(0, Math.min(1, location));
}

function nextClampedMaxWidth(
  hint: TextClampHint | null,
  kept: number,
  rootWidth: number,
  boundaryCount: number,
): Pick<TextClampHint, "clampedMaxWidth"> {
  if (kept >= boundaryCount) {
    return {};
  }

  return {
    clampedMaxWidth: Math.max(rootWidth, hint?.clampedMaxWidth ?? rootWidth),
  };
}

function nextWordFallbackMaxWidth(
  prepared: PreparedText,
  result: TextClampResult,
  hint: TextClampHint | null,
  rootWidth: number,
): Pick<TextClampHint, "wordFallbackMaxWidth"> {
  if (
    prepared.boundary !== "word" ||
    prepared.fallbackBoundaryOffsets === undefined ||
    result.boundaryOffsets !== prepared.fallbackBoundaryOffsets
  ) {
    return {};
  }

  const previous =
    hint?.boundaryOffsets === prepared.fallbackBoundaryOffsets && hint.rootWidth !== rootWidth
      ? (hint.wordFallbackMaxWidth ?? hint.rootWidth)
      : undefined;

  return {
    wordFallbackMaxWidth: Math.max(rootWidth, previous ?? rootWidth),
  };
}

function observedRankSlope(hint: TextClampHint | null, kept: number, rootWidth: number): RankSlope {
  if (!hint?.rootWidth || hint.rootWidth <= 0) {
    return {};
  }

  const deltaWidth = Math.abs(rootWidth - hint.rootWidth);
  const rankDelta = Math.abs(kept - hint.kept);
  if (deltaWidth === 0 || rankDelta === 0) {
    return previousRankSlope(hint);
  }

  const rankPerPx = rankDelta / deltaWidth;
  if (!Number.isFinite(rankPerPx) || rankPerPx <= 0) {
    return previousRankSlope(hint);
  }

  return {
    rankPerPx,
    rankPerPxWidth: deltaWidth,
  };
}

function previousRankSlope(hint: TextClampHint): RankSlope {
  const result: RankSlope = {};
  if (hint.rankPerPx !== undefined) {
    result.rankPerPx = hint.rankPerPx;
  }

  if (hint.rankPerPxWidth !== undefined) {
    result.rankPerPxWidth = hint.rankPerPxWidth;
  }

  return result;
}

function sameTextClampContext(
  hint: TextClampHint | null,
  context: TextClampContext,
): hint is TextClampHint {
  return (
    !!hint &&
    hint.ellipsis === context.ellipsis &&
    (hint.hasAffixes ?? false) === context.hasAffixes &&
    hint.lineCapacity === context.lineCapacity &&
    hint.layoutKey === context.layoutKey &&
    hint.lineLimit === context.lineLimit &&
    hint.maxHeight === context.maxHeight &&
    hint.ratio === context.ratio &&
    hint.spacing === context.spacing
  );
}

function sameTextFitContext(
  hint: TextClampHint | null,
  context: TextFitContext,
): hint is TextClampHint {
  return (
    !!hint &&
    hint.ellipsis === context.ellipsis &&
    hint.ratio === context.ratio &&
    hint.spacing === context.spacing
  );
}

function withTextClampMetrics(
  result: TextClampResult,
  hint: TextClampHint | null,
  prepared: PreparedText,
  rootWidth: number,
  context: TextClampContext,
): TextClampResult {
  const { ellipsis, layoutKey, lineLimit, maxHeight, ratio } = context;
  const metricHint = hint?.boundaryOffsets === result.boundaryOffsets ? hint : null;

  return {
    ...result,
    ellipsis,
    hasAffixes: context.hasAffixes || undefined,
    layoutKey,
    lineLimit,
    maxHeight,
    ...nextClampedMaxWidth(metricHint, result.kept, rootWidth, result.boundaryOffsets.length - 1),
    ...nextWordFallbackMaxWidth(prepared, result, metricHint, rootWidth),
    ...observedRankSlope(metricHint, result.kept, rootWidth),
    lineCapacity: context.lineCapacity,
    ratio,
    rootWidth,
    spacing: context.spacing,
  };
}

function searchCountForCandidates(candidateCount: number, includeFullCandidate: boolean): number {
  return Math.max(1, candidateCount + (includeFullCandidate ? 1 : 0));
}

function estimatedSearchTarget(
  searchCount: number,
  hintKept: number,
  rootWidth: number,
  referenceWidth: number,
  rankPerPx: number,
): number {
  const widthDelta = rootWidth - referenceWidth;
  const rankMove = Math.ceil(Math.abs(widthDelta) * rankPerPx);
  const direction = Math.sign(widthDelta);
  const target = hintKept + direction * rankMove;

  return Math.max(0, Math.min(searchCount - 1, target));
}

function comparableWidthScale(width: number, referenceWidth: number): boolean {
  return (
    Math.min(width, referenceWidth) * maxComparableWidthRatio >= Math.max(width, referenceWidth)
  );
}

function warmSearchCanBeatCold(
  searchCount: number,
  hintKept: number,
  estimatedTarget: number,
  allowRiskBudget = false,
): boolean {
  const coldProbes = estimateColdSearchMaxProbeCount(searchCount);
  const warmProbes = estimateWarmSearchProbeCount(searchCount, hintKept, estimatedTarget);
  const rankMove = Math.abs(estimatedTarget - hintKept);

  return (
    rankMove <= coldProbes &&
    (warmProbes < coldProbes ||
      (allowRiskBudget && warmProbes <= coldProbes + warmSearchProbeRiskBudget))
  );
}

function estimateWarmSearch(input: WarmSearchInput): WarmSearchEstimate | null {
  const { candidateCount, hintKept, includeFullCandidate, rankPerPx, referenceWidth, rootWidth } =
    input;

  if (
    !Number.isFinite(rankPerPx) ||
    rankPerPx <= 0 ||
    referenceWidth <= 0 ||
    !comparableWidthScale(rootWidth, referenceWidth)
  ) {
    return null;
  }

  const searchCount = searchCountForCandidates(candidateCount, includeFullCandidate);
  const target = estimatedSearchTarget(searchCount, hintKept, rootWidth, referenceWidth, rankPerPx);

  return {
    rankMove: Math.abs(target - hintKept),
    searchCount,
    target,
  };
}

function warmRiskBudgetApplies(
  boundary: ClampBoundary,
  hasAffixes: boolean,
  includeFullCandidate: boolean,
  rankMove: number,
  lineCapacity: number | undefined,
): boolean {
  if (rankMove <= warmSearchLocalCoverage()) {
    return true;
  }

  if (lineCapacity === 1) {
    return false;
  }

  if (boundary === "word") {
    return true;
  }

  return includeFullCandidate && lineCapacity !== undefined && lineCapacity >= 2 && hasAffixes;
}

function warmEstimateCanBeatCold(input: WarmSearchInput, estimate: WarmSearchEstimate): boolean {
  return warmSearchCanBeatCold(
    estimate.searchCount,
    input.hintKept,
    estimate.target,
    warmRiskBudgetApplies(
      input.boundary,
      input.hasAffixes,
      input.includeFullCandidate,
      estimate.rankMove,
      input.lineCapacity,
    ),
  );
}

function warmSearchStaysLocal(input: WarmSearchInput): boolean {
  const estimate = estimateWarmSearch(input);

  return estimate !== null && warmEstimateCanBeatCold(input, estimate);
}

function warmSearchStaysLocalFromHint(
  input: WarmHintInput,
  rankPerPx: number,
  referenceWidth: number,
): boolean {
  const {
    boundary,
    candidateCount,
    hasAffixes,
    hint,
    includeFullCandidate,
    lineCapacity,
    rootWidth,
  } = input;

  return warmSearchStaysLocal({
    boundary,
    candidateCount,
    hasAffixes,
    hintKept: hint.kept,
    includeFullCandidate,
    lineCapacity,
    rankPerPx,
    referenceWidth,
    rootWidth,
  });
}

function warmSearchStaysLocalBySlope(input: WarmHintInput): boolean {
  const { hint, rootWidth } = input;
  const { rankPerPx, rankPerPxWidth, rootWidth: hintWidth } = hint;
  if (
    rankPerPx === undefined ||
    rankPerPxWidth === undefined ||
    hintWidth === undefined ||
    rankPerPx <= 0 ||
    rankPerPxWidth <= 0
  ) {
    return false;
  }

  const deltaWidth = Math.abs(rootWidth - hintWidth);
  if (!comparableWidthScale(rootWidth, hintWidth)) {
    return false;
  }

  if (deltaWidth > rankPerPxWidth) {
    return false;
  }

  return warmSearchStaysLocalFromHint(input, rankPerPx, hintWidth);
}

function warmSearchStaysLocalByVisibleDensity(input: WarmHintInput): boolean {
  const { hint } = input;
  const hintWidth = hint.rootWidth;
  if (hintWidth === undefined || hintWidth <= 0 || hint.kept <= 0) {
    return false;
  }

  return warmSearchStaysLocalFromHint(input, hint.kept / hintWidth, hintWidth);
}

function canUseTextLayoutHint(
  hint: TextClampHint | null,
  boundary: ClampBoundary,
  rootWidth: number,
  context: TextClampContext,
  includeFullCandidate = false,
): boolean {
  if (!hint) {
    return false;
  }

  if (hint.rootWidth === undefined || rootWidth === hint.rootWidth) {
    return true;
  }

  const candidateCount = hint.boundaryOffsets.length - 1;
  const warmHintInput: WarmHintInput = {
    boundary,
    candidateCount,
    hasAffixes: context.hasAffixes,
    hint,
    includeFullCandidate,
    lineCapacity: context.lineCapacity,
    rootWidth,
  };

  return (
    warmSearchStaysLocalBySlope(warmHintInput) ||
    warmSearchStaysLocalByVisibleDensity(warmHintInput)
  );
}

export function canSkipFullTextFit(
  prepared: PreparedText,
  hint: TextClampHint | null,
  rootWidth: number,
  context: TextClampContext,
): boolean {
  if (
    !hint ||
    hint.boundaryOffsets !== prepared.boundaryOffsets ||
    !sameTextClampContext(hint, context) ||
    hint.rootWidth === undefined
  ) {
    return false;
  }

  const candidateCount = prepared.boundaryOffsets.length - 1;
  if (hint.kept >= candidateCount) {
    return false;
  }

  if (rootWidth <= hint.rootWidth) {
    return true;
  }

  const warmSearchInput = {
    boundary: prepared.boundary,
    candidateCount,
    hasAffixes: context.hasAffixes,
    hintKept: hint.kept,
    includeFullCandidate: true,
    lineCapacity: context.lineCapacity,
    rankPerPx: hint.kept / hint.rootWidth,
    referenceWidth: hint.rootWidth,
    rootWidth,
  };
  const estimate = estimateWarmSearch(warmSearchInput);

  return (
    estimate !== null &&
    estimate.target < candidateCount &&
    warmEstimateCanBeatCold(warmSearchInput, estimate)
  );
}

function fallbackSearchPrepared(
  prepared: PreparedText,
  hint: TextClampHint | null,
  rootWidth: number,
): PreparedText {
  if (
    prepared.boundary !== "word" ||
    !prepared.fallbackBoundaryOffsets ||
    hint?.boundaryOffsets !== prepared.fallbackBoundaryOffsets ||
    hint.rootWidth === undefined ||
    rootWidth === hint.rootWidth
  ) {
    return prepared;
  }

  const fallbackMaxWidth = hint.wordFallbackMaxWidth ?? hint.rootWidth;
  if (rootWidth > fallbackMaxWidth) {
    return prepared;
  }

  return {
    text: prepared.text,
    boundary: "grapheme",
    boundaryOffsets: prepared.fallbackBoundaryOffsets,
  };
}

function shouldVerifyFullTextCandidate(
  skipFullFit: boolean,
  hint: TextClampHint | null,
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

export function clampTextToFit({
  ellipsis,
  expansionLimit = defaultWarmExpansionLimit,
  fits,
  hint,
  includeFullCandidate = false,
  prepared,
  ratio,
  spacing = "trim",
  verifyFullCandidate = true,
}: TextClampFitInput): TextClampResult {
  const boundaryCount = prepared.boundaryOffsets.length - 1;
  const searchCount = Math.max(1, boundaryCount + (includeFullCandidate ? 1 : 0));
  const context: TextFitContext = {
    ellipsis,
    ratio,
    spacing,
  };
  const textHint = hint ?? null;
  let checkedFullCandidate = false;

  function fitsKeptCount(kept: number): boolean {
    if (includeFullCandidate && kept >= boundaryCount) {
      checkedFullCandidate = true;
    }

    return fits(displayTextForKeptCount(prepared, ratio, ellipsis, kept, spacing));
  }

  // The search helper works over indexes. For text, the index is the number of
  // boundary units kept, with at least the zero-kept ellipsis candidate present.
  let best = Math.max(
    0,
    findLastFittingIndex(
      searchCount,
      fitsKeptCount,
      textHint?.boundaryOffsets === prepared.boundaryOffsets &&
        sameTextFitContext(textHint, context)
        ? textHint.kept
        : null,
      expansionLimit,
    ),
  );

  if (
    includeFullCandidate &&
    verifyFullCandidate &&
    best < boundaryCount &&
    !checkedFullCandidate
  ) {
    // The full-text candidate omits the ellipsis, so it is not guaranteed to be
    // monotonic with the truncated candidates that precede it.
    checkedFullCandidate = true;
    if (fitsKeptCount(boundaryCount)) {
      best = boundaryCount;
    }
  }

  if (best === 0 && prepared.fallbackBoundaryOffsets) {
    // Whole-word truncation should never fail completely just because a single
    // word is wider than the container; retry at grapheme granularity.
    return clampTextToFit({
      ellipsis,
      expansionLimit,
      fits,
      hint: textHint,
      includeFullCandidate,
      prepared: {
        text: prepared.text,
        boundary: "grapheme",
        boundaryOffsets: prepared.fallbackBoundaryOffsets,
      },
      ratio,
      spacing,
      verifyFullCandidate,
    });
  }

  const text = displayTextForKeptCount(prepared, ratio, ellipsis, best, spacing);

  return {
    boundaryOffsets: prepared.boundaryOffsets,
    ellipsis,
    kept: best,
    ratio,
    spacing,
    text,
  };
}

export function clampTextToLayout({
  content,
  ellipsis,
  hasAffixes = false,
  hint,
  lineCapacity,
  layoutKey,
  lineLimit,
  maxHeight,
  prepared,
  ratio,
  root,
  rootWidth,
  forceSkipFullFit = false,
  simpleLineFit,
  target,
}: TextClampLayoutInput): TextClampResult | null {
  if (rootWidth <= 0) {
    // Measuring against an unlaid-out root would only cache a bogus clamp.
    return null;
  }

  const { text } = prepared;
  const context: TextClampContext = {
    ellipsis,
    hasAffixes,
    lineCapacity,
    layoutKey,
    lineLimit,
    maxHeight,
    ratio,
    spacing: "trim",
  };
  const currentHint = hint ?? null;
  const textHint = sameTextClampContext(currentHint, context) ? currentHint : null;
  const skipFullFit =
    forceSkipFullFit || canSkipFullTextFit(prepared, textHint, rootWidth, context);
  const searchHint = canUseTextLayoutHint(
    textHint,
    prepared.boundary,
    rootWidth,
    context,
    skipFullFit,
  )
    ? textHint
    : null;
  const expansionLimit =
    prepared.boundary === "word" ? wordWarmExpansionLimit : defaultWarmExpansionLimit;
  const visibleBoundsCache: VisibleBoundsCache | undefined =
    maxHeight === undefined ? undefined : {};
  let currentText = target.textContent ?? "";

  function applyText(nextText: string): void {
    if (nextText !== currentText) {
      setElementText(target, nextText);
      currentText = nextText;
    }
  }

  if (!skipFullFit) {
    applyText(text);
    if (fitsContent(root, content, lineLimit, maxHeight, true, visibleBoundsCache, simpleLineFit)) {
      // The full source is the cheapest and most correct answer when it fits.
      // Store it as a warm-start hint so later shrink passes begin from full text.
      return withTextClampMetrics(
        {
          boundaryOffsets: prepared.boundaryOffsets,
          kept: prepared.boundaryOffsets.length - 1,
          text,
        },
        textHint,
        prepared,
        rootWidth,
        context,
      );
    }
  }

  const result = clampTextToFit({
    ellipsis,
    fits(candidate) {
      applyText(candidate);
      return fitsContent(
        root,
        content,
        lineLimit,
        maxHeight,
        true,
        visibleBoundsCache,
        simpleLineFit,
      );
    },
    expansionLimit,
    hint: searchHint,
    includeFullCandidate: skipFullFit,
    prepared: fallbackSearchPrepared(prepared, textHint, rootWidth),
    ratio,
    verifyFullCandidate: shouldVerifyFullTextCandidate(
      skipFullFit,
      searchHint,
      rootWidth,
      prepared.boundaryOffsets.length - 1,
    ),
  });
  applyText(result.text);

  return withTextClampMetrics(result, textHint, prepared, rootWidth, context);
}
