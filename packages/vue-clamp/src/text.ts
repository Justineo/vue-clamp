import { fitsContent } from "./layout.ts";

import type { LineClampLocation } from "./types.ts";

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export interface PreparedText {
  text: string;
  boundaryOffsets: number[];
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

export function prepareText(text: string): PreparedText {
  if (isAsciiSafe(text)) {
    return {
      text,
      boundaryOffsets: Array.from({ length: text.length + 1 }, (_, index) => index),
    };
  }

  const boundaryOffsets = [0];
  let offset = 0;

  for (const part of graphemeSegmenter.segment(text)) {
    offset += part.segment.length;
    boundaryOffsets.push(offset);
  }

  return {
    text,
    boundaryOffsets,
  };
}

export function splitGraphemes(text: string): string[] {
  const prepared = prepareText(text);
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
  const graphemeCount = boundaryOffsets.length - 1;

  if (kept >= graphemeCount) {
    return text;
  }

  const prefix = Math.floor(kept * ratio);
  const suffix = kept - prefix;
  const prefixText = text.slice(0, boundaryOffsets[prefix]);
  const suffixText = text.slice(boundaryOffsets[graphemeCount - suffix]);
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

export function searchKeptCount(graphemeCount: number, fits: (kept: number) => boolean): number {
  let low = 0;
  let high = graphemeCount - 1;
  let best = 0;

  while (low <= high) {
    const kept = Math.floor((low + high) / 2);

    if (fits(kept)) {
      best = kept;
      low = kept + 1;
    } else {
      high = kept - 1;
    }
  }

  return best;
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

export function searchClampedTextToFit(
  preparedText: PreparedText,
  locationRatio: number,
  ellipsis: string,
  fits: (text: string) => boolean,
  spacing: TextClampSpacing = "trim",
): string {
  const graphemeCount = preparedText.boundaryOffsets.length - 1;
  const best = searchKeptCount(graphemeCount, (kept) =>
    fits(displayTextForKeptCount(preparedText, locationRatio, ellipsis, kept, spacing)),
  );
  const text = displayTextForKeptCount(preparedText, locationRatio, ellipsis, best, spacing);

  fits(text);
  return text;
}

export function canUseNativeClamp(
  expanded: boolean,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
  locationRatio: number,
  ellipsis: string,
): string | null {
  if (expanded || lineLimit !== 1 || maxHeight !== undefined || locationRatio !== 1) {
    return null;
  }

  return ellipsis === "…" ? "ellipsis" : null;
}

export function isNativeClamped(textElement: HTMLElement): boolean | null {
  if (textElement.clientWidth <= 0 || textElement.getBoundingClientRect().width <= 0) {
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
): string | null {
  if (rootElement.getBoundingClientRect().width <= 0) {
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
    return text;
  }

  return searchClampedTextToFit(preparedText, locationRatio, ellipsis, applyText);
}
