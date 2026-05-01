import { fitsContent } from "./layout.ts";
import { findLastFittingIndex } from "./search.ts";

import type { ClampBoundary, LineClampLocation } from "./types.ts";

// Text preparation is separated from DOM measurement so width-only reclamps can
// reuse the same boundary list instead of segmenting the source text again.
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

const wordSegmenter = new Intl.Segmenter(undefined, {
  granularity: "word",
});

export interface PreparedText {
  text: string;
  boundary: ClampBoundary;
  boundaryOffsets: number[];
  fallbackBoundaryOffsets?: number[];
}

export interface TextClampResult {
  boundaryOffsets: readonly number[];
  kept: number;
  text: string;
}

export type TextClampSpacing = "trim" | "preserve-outer";

function isAsciiSafe(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code < 0x20 || code > 0x7e) && code !== 0x09 && code !== 0x0a) {
      return false;
    }
  }

  return true;
}

function graphemeBoundaryOffsets(text: string): number[] {
  if (isAsciiSafe(text)) {
    // ASCII has one UTF-16 code unit per grapheme in the range we accept here,
    // so this hot path avoids Intl.Segmenter for common English/code strings.
    return Array.from({ length: text.length + 1 }, (_, index) => index);
  }

  const boundaryOffsets = [0];
  let offset = 0;

  for (const part of graphemeSegmenter.segment(text)) {
    offset += part.segment.length;
    boundaryOffsets.push(offset);
  }

  return boundaryOffsets;
}

function wordBoundaryOffsets(text: string, fallbackBoundaryOffsets: readonly number[]): number[] {
  const fallbackOffsetSet = new Set(fallbackBoundaryOffsets);
  const boundaryOffsets = [0];

  for (const part of wordSegmenter.segment(text)) {
    const offset = part.index + part.segment.length;
    // Only keep word boundaries that are also grapheme boundaries. This prevents
    // a word-level cut from landing inside a composed character.
    if (fallbackOffsetSet.has(offset) && boundaryOffsets[boundaryOffsets.length - 1] !== offset) {
      boundaryOffsets.push(offset);
    }
  }

  if (boundaryOffsets[boundaryOffsets.length - 1] !== text.length) {
    boundaryOffsets.push(text.length);
  }

  return boundaryOffsets;
}

export function prepareText(text: string, boundary: ClampBoundary = "grapheme"): PreparedText {
  const fallbackBoundaryOffsets = graphemeBoundaryOffsets(text);

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
    boundaryOffsets: wordBoundaryOffsets(text, fallbackBoundaryOffsets),
    fallbackBoundaryOffsets,
  };
}

export function splitGraphemes(text: string): string[] {
  const prepared = prepareText(text, "grapheme");
  const { boundaryOffsets } = prepared;
  const graphemes: string[] = [];

  for (let index = 1; index < boundaryOffsets.length; index += 1) {
    graphemes.push(text.slice(boundaryOffsets[index - 1], boundaryOffsets[index]));
  }

  return graphemes;
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
  const prefixText = text.slice(0, boundaryOffsets[prefix]);
  const suffixText = text.slice(boundaryOffsets[boundaryCount - suffix]);
  const trimPrefix = spacing === "preserve-outer" ? prefixText.trimEnd() : prefixText.trim();
  const trimSuffix = spacing === "preserve-outer" ? suffixText.trimStart() : suffixText.trim();

  if (prefix <= 0) {
    return `${ellipsis}${trimSuffix}`;
  }

  if (suffix <= 0) {
    return `${trimPrefix}${ellipsis}`;
  }

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

export function clampTextToFit(
  preparedText: PreparedText,
  locationRatio: number,
  ellipsis: string,
  fits: (text: string) => boolean,
  spacing: TextClampSpacing = "trim",
  hint?: { boundaryOffsets: readonly number[]; kept: number } | null,
): TextClampResult {
  const boundaryCount = preparedText.boundaryOffsets.length - 1;
  // The search helper works over indexes. For text, the index is the number of
  // boundary units kept, with at least the zero-kept ellipsis candidate present.
  const best = Math.max(
    0,
    findLastFittingIndex(
      Math.max(1, boundaryCount),
      (kept) => fits(displayTextForKeptCount(preparedText, locationRatio, ellipsis, kept, spacing)),
      hint?.boundaryOffsets === preparedText.boundaryOffsets ? { index: hint.kept } : null,
    ),
  );

  if (best === 0 && preparedText.fallbackBoundaryOffsets) {
    // Whole-word truncation should never fail completely just because a single
    // word is wider than the container; retry at grapheme granularity.
    return clampTextToFit(
      {
        text: preparedText.text,
        boundary: "grapheme",
        boundaryOffsets: preparedText.fallbackBoundaryOffsets,
      },
      locationRatio,
      ellipsis,
      fits,
      spacing,
      hint,
    );
  }

  const text = displayTextForKeptCount(preparedText, locationRatio, ellipsis, best, spacing);

  // Leave the measured DOM on the exact text returned to the caller, even when
  // the final binary-search probe happened to be a neighboring candidate.
  fits(text);
  return {
    boundaryOffsets: preparedText.boundaryOffsets,
    kept: best,
    text,
  };
}

export function canUseNativeClamp(
  expanded: boolean,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
  locationRatio: number,
  ellipsis: string,
  boundary: ClampBoundary,
): string | null {
  if (
    expanded ||
    lineLimit !== 1 ||
    maxHeight !== undefined ||
    locationRatio !== 1 ||
    boundary !== "grapheme"
  ) {
    // Native single-line ellipsis cannot honor custom boundaries, custom
    // ellipsis text, or non-end locations, so those cases stay on the JS path.
    return null;
  }

  return ellipsis === "…" ? "ellipsis" : null;
}

export function isNativeClamped(textElement: HTMLElement): boolean | null {
  if (textElement.clientWidth <= 0 || textElement.getBoundingClientRect().width <= 0) {
    // A zero-width element is not a reliable overflow signal; let the caller
    // keep the unclamped source until layout becomes measurable.
    return null;
  }

  return textElement.scrollWidth > textElement.clientWidth + 0.5;
}

export function clampTextToLayout(
  preparedText: PreparedText,
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  textElement: HTMLElement,
  locationRatio: number,
  ellipsis: string,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
  hint?: { boundaryOffsets: readonly number[]; kept: number } | null,
): TextClampResult | null {
  if (rootElement.getBoundingClientRect().width <= 0) {
    // Measuring against an unlaid-out root would only cache a bogus clamp.
    return null;
  }

  const { text } = preparedText;
  let currentText = textElement.textContent ?? "";

  function applyText(nextText: string): boolean {
    if (nextText !== currentText) {
      textElement.textContent = nextText;
      currentText = nextText;
    }

    return fitsContent(rootElement, contentElement, lineLimit, maxHeight);
  }

  if (applyText(text)) {
    // The full source is the cheapest and most correct answer when it fits.
    // Store it as a warm-start hint so later shrink passes begin from full text.
    return {
      boundaryOffsets: preparedText.boundaryOffsets,
      kept: preparedText.boundaryOffsets.length - 1,
      text,
    };
  }

  return clampTextToFit(preparedText, locationRatio, ellipsis, applyText, "trim", hint);
}
