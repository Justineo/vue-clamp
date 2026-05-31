import { fitsContent, visibleRootTop } from "./layout.ts";
import { findLastFittingIndex, warmSearchLocalCoverage } from "./search.ts";

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
  readonly kept: number;
  readonly rankObserved?: boolean;
  readonly rankPerPx?: number;
  readonly rootWidth?: number;
}

export interface TextClampResult extends TextClampHint {
  readonly text: string;
}

type MaybeTextClampHint = TextClampHint | null | undefined;

const layoutHintMaxWidthDelta = 32;
const fullFitSkipGrowLimit = 24;

export type TextClampSpacing = "trim" | "preserve-outer";

export type TextClampFitInput = {
  readonly ellipsis: string;
  readonly fits: (text: string) => boolean;
  readonly hint?: MaybeTextClampHint;
  readonly includeFullCandidate?: boolean;
  readonly prepared: PreparedText;
  readonly ratio: number;
  readonly spacing?: TextClampSpacing;
};

export type TextClampLayoutInput = {
  readonly content: HTMLElement;
  readonly ellipsis: string;
  readonly hint?: MaybeTextClampHint;
  readonly lineLimit: number | undefined;
  readonly maxHeight: ClampLength | undefined;
  readonly prepared: PreparedText;
  readonly ratio: number;
  readonly root: HTMLElement;
  readonly rootWidth: number;
  readonly skipFullFit?: boolean;
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

function initialRankPerPx(
  rank: number,
  rootWidth: number,
  lineLimit: number | undefined,
  candidateCount: number,
): number {
  const lineScale = rank >= candidateCount && lineLimit !== undefined ? lineLimit : 1;

  return Math.max(1 / rootWidth, rank / (rootWidth * lineScale));
}

function rankPerPxForHint(
  hint: TextClampHint,
  lineLimit: number | undefined,
  candidateCount: number,
): number {
  const rankPerPx = hint.rankPerPx;
  if (rankPerPx !== undefined && Number.isFinite(rankPerPx) && rankPerPx > 0) {
    return rankPerPx;
  }

  const rootWidth = hint.rootWidth;
  if (rootWidth === undefined || rootWidth <= 0) {
    return 1;
  }

  return initialRankPerPx(hint.kept, rootWidth, lineLimit, candidateCount);
}

function nextRankPerPx(
  hint: MaybeTextClampHint,
  kept: number,
  rootWidth: number,
  lineLimit: number | undefined,
  candidateCount: number,
): number {
  if (!hint?.rootWidth || hint.rootWidth <= 0) {
    return initialRankPerPx(kept, rootWidth, lineLimit, candidateCount);
  }

  const deltaWidth = Math.abs(rootWidth - hint.rootWidth);
  if (deltaWidth === 0) {
    return rankPerPxForHint(hint, lineLimit, candidateCount);
  }

  const observed = Math.abs(kept - hint.kept) / deltaWidth;

  return Number.isFinite(observed) && observed > 0
    ? observed
    : rankPerPxForHint(hint, lineLimit, candidateCount);
}

function nextRankObserved(hint: MaybeTextClampHint, rootWidth: number): boolean {
  return !!hint?.rootWidth && hint.rootWidth > 0 && rootWidth !== hint.rootWidth;
}

function withTextClampMetrics(
  result: TextClampResult,
  hint: MaybeTextClampHint,
  rootWidth: number,
  lineLimit: number | undefined,
  boundary: ClampBoundary,
): TextClampResult {
  if (boundary !== "word") {
    return {
      ...result,
      rootWidth,
    };
  }

  const candidateCount = result.boundaryOffsets.length - 1;
  const metricHint = hint?.boundaryOffsets === result.boundaryOffsets ? hint : null;

  return {
    ...result,
    rankObserved: nextRankObserved(metricHint, rootWidth),
    rankPerPx: nextRankPerPx(metricHint, result.kept, rootWidth, lineLimit, candidateCount),
    rootWidth,
  };
}

function searchCountForText(candidateCount: number, includeFullCandidate: boolean): number {
  return Math.max(1, candidateCount + (includeFullCandidate ? 1 : 0));
}

function warmTextSearchStaysLocal(
  hint: TextClampHint,
  rootWidth: number,
  lineLimit: number | undefined,
  candidateCount: number,
  includeFullCandidate: boolean,
): boolean {
  const searchCount = searchCountForText(candidateCount, includeFullCandidate);
  const maxIndex = searchCount - 1;
  const deltaWidth = rootWidth - (hint.rootWidth ?? rootWidth);
  const rankMove = Math.abs(deltaWidth) * rankPerPxForHint(hint, lineLimit, candidateCount);
  const target =
    Math.max(0, Math.min(maxIndex, hint.kept)) + Math.sign(deltaWidth) * Math.ceil(rankMove);
  const start = Math.max(0, Math.min(maxIndex, hint.kept));
  const localCoverage = warmSearchLocalCoverage();

  return (
    Math.ceil(Math.log2(searchCount + 1)) > localCoverage &&
    Math.abs(Math.max(0, Math.min(maxIndex, target)) - start) <= localCoverage
  );
}

function canUseTextLayoutHint(
  hint: MaybeTextClampHint,
  boundary: ClampBoundary,
  rootWidth: number,
  lineLimit: number | undefined,
  includeFullCandidate = false,
): boolean {
  if (!hint) {
    return false;
  }

  if (hint.rootWidth === undefined) {
    return true;
  }

  if (Math.abs(rootWidth - hint.rootWidth) <= layoutHintMaxWidthDelta) {
    return true;
  }

  if (boundary !== "word") {
    return false;
  }

  if (!hint.rankObserved) {
    return false;
  }

  const candidateCount = hint.boundaryOffsets.length - 1;

  return warmTextSearchStaysLocal(hint, rootWidth, lineLimit, candidateCount, includeFullCandidate);
}

export function canSkipFullTextFit(
  prepared: PreparedText,
  hint: MaybeTextClampHint,
  rootWidth: number,
): boolean {
  if (!hint || hint.boundaryOffsets !== prepared.boundaryOffsets || hint.rootWidth === undefined) {
    return false;
  }

  const candidateCount = prepared.boundaryOffsets.length - 1;
  return hint.kept < candidateCount && rootWidth <= hint.rootWidth + fullFitSkipGrowLimit;
}

export function clampTextToFit({
  ellipsis,
  fits,
  hint,
  includeFullCandidate = false,
  prepared,
  ratio,
  spacing = "trim",
}: TextClampFitInput): TextClampResult {
  const boundaryCount = prepared.boundaryOffsets.length - 1;
  const searchCount = Math.max(1, boundaryCount + (includeFullCandidate ? 1 : 0));

  // The search helper works over indexes. For text, the index is the number of
  // boundary units kept, with at least the zero-kept ellipsis candidate present.
  const best = Math.max(
    0,
    findLastFittingIndex(
      searchCount,
      (kept) => fits(displayTextForKeptCount(prepared, ratio, ellipsis, kept, spacing)),
      hint?.boundaryOffsets === prepared.boundaryOffsets ? hint.kept : null,
    ),
  );

  if (best === 0 && prepared.fallbackBoundaryOffsets) {
    // Whole-word truncation should never fail completely just because a single
    // word is wider than the container; retry at grapheme granularity.
    return clampTextToFit({
      ellipsis,
      fits,
      hint,
      includeFullCandidate,
      prepared: {
        text: prepared.text,
        boundary: "grapheme",
        boundaryOffsets: prepared.fallbackBoundaryOffsets,
      },
      ratio,
      spacing,
    });
  }

  const text = displayTextForKeptCount(prepared, ratio, ellipsis, best, spacing);

  return {
    boundaryOffsets: prepared.boundaryOffsets,
    kept: best,
    text,
  };
}

export function clampTextToLayout({
  content,
  ellipsis,
  hint,
  lineLimit,
  maxHeight,
  prepared,
  ratio,
  root,
  rootWidth,
  skipFullFit = false,
  target,
}: TextClampLayoutInput): TextClampResult | null {
  if (rootWidth <= 0) {
    // Measuring against an unlaid-out root would only cache a bogus clamp.
    return null;
  }

  const { text } = prepared;
  const cachedVisibleTop = maxHeight === undefined ? undefined : visibleRootTop(root);
  const searchHint = canUseTextLayoutHint(
    hint,
    prepared.boundary,
    rootWidth,
    lineLimit,
    skipFullFit,
  )
    ? hint
    : null;
  let currentText = target.textContent ?? "";

  function applyText(nextText: string): void {
    if (nextText !== currentText) {
      target.textContent = nextText;
      currentText = nextText;
    }
  }

  if (!skipFullFit) {
    applyText(text);
    if (fitsContent(root, content, lineLimit, maxHeight, true, cachedVisibleTop)) {
      // The full source is the cheapest and most correct answer when it fits.
      // Store it as a warm-start hint so later shrink passes begin from full text.
      return withTextClampMetrics(
        {
          boundaryOffsets: prepared.boundaryOffsets,
          kept: prepared.boundaryOffsets.length - 1,
          text,
        },
        hint,
        rootWidth,
        lineLimit,
        prepared.boundary,
      );
    }
  }

  const result = clampTextToFit({
    ellipsis,
    fits(candidate) {
      applyText(candidate);
      return fitsContent(root, content, lineLimit, maxHeight, true, cachedVisibleTop);
    },
    hint: searchHint,
    includeFullCandidate: skipFullFit,
    prepared,
    ratio,
  });
  applyText(result.text);

  return withTextClampMetrics(result, hint, rootWidth, lineLimit, prepared.boundary);
}
