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
  const graphemes: string[] = [];

  for (let index = 1; index < prepared.boundaryOffsets.length; index += 1) {
    graphemes.push(
      text.slice(prepared.boundaryOffsets[index - 1], prepared.boundaryOffsets[index]),
    );
  }

  return graphemes;
}

export function displayTextForKeptCount(
  prepared: PreparedText,
  ratio: number,
  ellipsis: string,
  kept: number,
): string {
  const graphemeCount = prepared.boundaryOffsets.length - 1;

  if (kept >= graphemeCount) {
    return prepared.text;
  }

  const prefix = Math.floor(kept * ratio);
  const suffix = kept - prefix;

  if (prefix <= 0) {
    return `${ellipsis}${prepared.text.slice(prepared.boundaryOffsets[graphemeCount - suffix]).trim()}`;
  }

  if (suffix <= 0) {
    return `${prepared.text.slice(0, prepared.boundaryOffsets[prefix]).trim()}${ellipsis}`;
  }

  return `${prepared.text.slice(0, prepared.boundaryOffsets[prefix]).trim()}${ellipsis}${prepared.text
    .slice(prepared.boundaryOffsets[graphemeCount - suffix])
    .trim()}`;
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

  const graphemeCount = preparedText.boundaryOffsets.length - 1;
  let currentText = textElement.textContent ?? "";

  function applyKept(kept: number): string {
    const nextText = displayTextForKeptCount(preparedText, locationRatio, ellipsis, kept);

    if (nextText !== currentText) {
      textElement.textContent = nextText;
      currentText = nextText;
    }

    return nextText;
  }

  function search(low: number, high: number, best: number): number {
    while (low <= high) {
      const kept = Math.floor((low + high) / 2);

      applyKept(kept);

      if (fitsContent(rootElement, contentElement, lineLimit, maxHeight)) {
        best = kept;
        low = kept + 1;
      } else {
        high = kept - 1;
      }
    }

    return best;
  }

  if (
    applyKept(graphemeCount) === preparedText.text &&
    fitsContent(rootElement, contentElement, lineLimit, maxHeight)
  ) {
    return preparedText.text;
  }

  const best = search(0, graphemeCount - 1, 0);

  return applyKept(best);
}
