import { fitsContent } from "./layout.ts";

import type { LineClampLocation } from "./types.ts";

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export interface PreparedText {
  text: string;
  boundaryOffsets: number[];
}

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
): string {
  const { boundaryOffsets, text } = prepared;
  const graphemeCount = boundaryOffsets.length - 1;

  if (kept >= graphemeCount) {
    return text;
  }

  const prefix = Math.floor(kept * ratio);
  const suffix = kept - prefix;

  if (prefix <= 0) {
    return `${ellipsis}${text.slice(boundaryOffsets[graphemeCount - suffix]).trim()}`;
  }

  if (suffix <= 0) {
    return `${text.slice(0, boundaryOffsets[prefix]).trim()}${ellipsis}`;
  }

  return `${text.slice(0, boundaryOffsets[prefix]).trim()}${ellipsis}${text
    .slice(boundaryOffsets[graphemeCount - suffix])
    .trim()}`;
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

  const { boundaryOffsets, text } = preparedText;
  const graphemeCount = boundaryOffsets.length - 1;
  let currentText = textElement.textContent ?? "";

  function applyKept(kept: number): string {
    const nextText = displayTextForKeptCount(preparedText, locationRatio, ellipsis, kept);

    if (nextText !== currentText) {
      textElement.textContent = nextText;
      currentText = nextText;
    }

    return nextText;
  }

  if (
    applyKept(graphemeCount) === text &&
    fitsContent(rootElement, contentElement, lineLimit, maxHeight)
  ) {
    return text;
  }

  const best = searchKeptCount(graphemeCount, (kept) => {
    applyKept(kept);
    return fitsContent(rootElement, contentElement, lineLimit, maxHeight);
  });

  return applyKept(best);
}
