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

type Spacing = "trim" | "preserve-outer";

type FitInput = {
  ellipsis: string;
  fits: (text: string) => boolean;
  hint?: { boundaryOffsets: readonly number[]; kept: number } | null | undefined;
  prepared: PreparedText;
  ratio: number;
  spacing?: Spacing;
};

type LayoutInput = {
  content: HTMLElement;
  ellipsis: string;
  hint?: { boundaryOffsets: readonly number[]; kept: number } | null | undefined;
  lineLimit: number | undefined;
  maxHeight: number | string | undefined;
  prepared: PreparedText;
  ratio: number;
  root: HTMLElement;
  target: HTMLElement;
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
  spacing: Spacing = "trim",
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

export function clampTextToFit({
  ellipsis,
  fits,
  hint,
  prepared,
  ratio,
  spacing = "trim",
}: FitInput): TextClampResult {
  const boundaryCount = prepared.boundaryOffsets.length - 1;

  // The search helper works over indexes. For text, the index is the number of
  // boundary units kept, with at least the zero-kept ellipsis candidate present.
  const best = Math.max(
    0,
    findLastFittingIndex(
      Math.max(1, boundaryCount),
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
  target,
}: LayoutInput): TextClampResult | null {
  if (root.getBoundingClientRect().width <= 0) {
    // Measuring against an unlaid-out root would only cache a bogus clamp.
    return null;
  }

  const { text } = prepared;
  let currentText = target.textContent ?? "";

  function applyText(nextText: string): void {
    if (nextText !== currentText) {
      target.textContent = nextText;
      currentText = nextText;
    }
  }

  applyText(text);
  if (fitsContent(root, content, lineLimit, maxHeight)) {
    // The full source is the cheapest and most correct answer when it fits.
    // Store it as a warm-start hint so later shrink passes begin from full text.
    return {
      boundaryOffsets: prepared.boundaryOffsets,
      kept: prepared.boundaryOffsets.length - 1,
      text,
    };
  }

  const result = clampTextToFit({
    ellipsis,
    fits(candidate) {
      applyText(candidate);
      return fitsContent(root, content, lineLimit, maxHeight);
    },
    hint,
    prepared,
    ratio,
  });
  applyText(result.text);

  return result;
}
