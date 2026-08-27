import { layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { prepareText } from "../text.ts";

import type { LayoutCursor, PreparedTextWithSegments } from "@chenglou/pretext";
import type { PreparedText } from "../text.ts";

const ellipsis = "…";
const ellipsisWidths = new Map<string, number>();
const needsWhitespaceNormalization = /[\t\n\r\f]| {2,}|^ | $/u;
const start: LayoutCursor = { graphemeIndex: 0, segmentIndex: 0 };

type LineClampResult = {
  readonly clamped: boolean;
  readonly text: string;
};

export type PreparedLineClamp = {
  readonly boundaries: PreparedText;
  readonly ellipsisWidth: number;
  readonly prepared: PreparedTextWithSegments;
  readonly segmentGraphemeStarts: readonly number[];
  readonly segmentWordRanks: readonly number[];
  readonly source: string;
};

function measureEllipsis(font: string): number {
  let width = ellipsisWidths.get(font);
  if (width === undefined) {
    width = measureNaturalWidth(prepareWithSegments(ellipsis, font));
    ellipsisWidths.set(font, width);
  }
  return width;
}

export function prepareLineClamp(source: string, font: string): PreparedLineClamp {
  const prepared = prepareWithSegments(source, font);
  const normalized = needsWhitespaceNormalization.test(source)
    ? prepared.segments.join("")
    : source;
  const boundaries = prepareText(normalized, "word");
  const fallbackOffsets = boundaries.fallbackBoundaryOffsets ?? boundaries.boundaryOffsets;
  const segmentGraphemeStarts = Array<number>(prepared.segments.length + 1);
  const segmentWordRanks = Array<number>(prepared.segments.length + 1);
  let fallbackIndex = 0;
  let offset = 0;
  let wordRank = 0;

  for (let index = 0; index < prepared.segments.length; index += 1) {
    while ((fallbackOffsets[fallbackIndex] ?? Number.POSITIVE_INFINITY) < offset) {
      fallbackIndex += 1;
    }
    while ((boundaries.boundaryOffsets[wordRank + 1] ?? Number.POSITIVE_INFINITY) <= offset) {
      wordRank += 1;
    }
    segmentGraphemeStarts[index] = fallbackIndex;
    segmentWordRanks[index] = wordRank;
    offset += prepared.segments[index]?.length ?? 0;
  }
  segmentGraphemeStarts[prepared.segments.length] = fallbackOffsets.length - 1;
  segmentWordRanks[prepared.segments.length] = boundaries.boundaryOffsets.length - 1;

  return {
    boundaries,
    ellipsisWidth: measureEllipsis(font),
    prepared,
    segmentGraphemeStarts,
    segmentWordRanks,
    source,
  };
}

function cursorGrapheme(input: PreparedLineClamp, cursor: LayoutCursor): number {
  return input.segmentGraphemeStarts[cursor.segmentIndex]! + cursor.graphemeIndex;
}

function displayEndClamp(text: string, offsets: readonly number[], kept: number): string {
  if (kept >= offsets.length - 1) return text;
  return `${text.slice(0, offsets[kept]).trim()}${ellipsis}`;
}

function keptAtOffset(
  offsets: readonly number[],
  offset: number,
  low: number,
  high: number,
): number {
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((offsets[middle] ?? Number.POSITIVE_INFINITY) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

export function clampPreparedLine(
  input: PreparedLineClamp,
  maxWidth: number,
  maxLines: number,
): LineClampResult {
  if (input.source.length === 0 || maxWidth <= 0 || maxLines < 1) {
    return { clamped: false, text: input.source };
  }

  let cursor = start;

  for (let line = 1; line < maxLines; line += 1) {
    const range = layoutNextLineRange(input.prepared, cursor, maxWidth);
    if (range === null) {
      return { clamped: false, text: input.source };
    }

    cursor = range.end;
    if (cursor.segmentIndex >= input.prepared.segments.length) {
      return { clamped: false, text: input.source };
    }
  }

  const fullLastLine = layoutNextLineRange(input.prepared, cursor, maxWidth);
  if (fullLastLine === null || fullLastLine.end.segmentIndex >= input.prepared.segments.length) {
    return { clamped: false, text: input.source };
  }

  const lastLineWidth = maxWidth - input.ellipsisWidth;
  if (lastLineWidth <= 0) {
    return {
      clamped: true,
      text: input.ellipsisWidth <= maxWidth ? ellipsis : "",
    };
  }

  const lastLine = layoutNextLineRange(input.prepared, fullLastLine.start, lastLineWidth);
  if (lastLine === null || lastLine.width > lastLineWidth + 0.5) {
    return { clamped: true, text: ellipsis };
  }

  const { graphemeIndex, segmentIndex } = lastLine.end;
  const grapheme = cursorGrapheme(input, lastLine.end);
  const { boundaries } = input;
  let offsets = boundaries.boundaryOffsets;
  let kept = input.segmentWordRanks[segmentIndex]!;
  if (graphemeIndex > 0) {
    const fallbackOffsets = boundaries.fallbackBoundaryOffsets ?? boundaries.boundaryOffsets;
    const segmentEnd = fallbackOffsets[input.segmentGraphemeStarts[segmentIndex + 1]!]!;
    if ((boundaries.boundaryOffsets[kept + 1] ?? Number.POSITIVE_INFINITY) < segmentEnd) {
      kept = keptAtOffset(
        boundaries.boundaryOffsets,
        fallbackOffsets[grapheme]!,
        kept,
        input.segmentWordRanks[segmentIndex + 1]!,
      );
    }
  }
  if (kept === 0 && grapheme > 0 && boundaries.fallbackBoundaryOffsets) {
    offsets = boundaries.fallbackBoundaryOffsets;
    kept = grapheme;
  }

  return {
    clamped: true,
    text: displayEndClamp(boundaries.text, offsets, kept),
  };
}
