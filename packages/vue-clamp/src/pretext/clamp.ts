import { layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { prepareText } from "../text.ts";

import type { LayoutCursor, PreparedTextWithSegments } from "@chenglou/pretext";
import type { PreparedText } from "../text.ts";

const ellipsis = "…";
const ellipsisWidths = new Map<string, number>();
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
  readonly source: string;
  readonly wordRanks: readonly number[];
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
  const boundaries = prepareText(prepared.segments.join(""), "word");
  const fallbackOffsets = boundaries.fallbackBoundaryOffsets ?? boundaries.boundaryOffsets;
  const segmentGraphemeStarts = Array<number>(prepared.segments.length);
  const wordRanks = Array<number>(fallbackOffsets.length);
  let fallbackIndex = 0;
  let offset = 0;

  for (let index = 0; index < prepared.segments.length; index += 1) {
    while ((fallbackOffsets[fallbackIndex] ?? Number.POSITIVE_INFINITY) < offset) {
      fallbackIndex += 1;
    }
    segmentGraphemeStarts[index] = fallbackIndex;
    offset += prepared.segments[index]?.length ?? 0;
  }

  let wordRank = 0;
  for (let index = 0; index < fallbackOffsets.length; index += 1) {
    while (
      (boundaries.boundaryOffsets[wordRank + 1] ?? Number.POSITIVE_INFINITY) <=
      (fallbackOffsets[index] ?? 0)
    ) {
      wordRank += 1;
    }
    wordRanks[index] = wordRank;
  }

  return {
    boundaries,
    ellipsisWidth: measureEllipsis(font),
    prepared,
    segmentGraphemeStarts,
    source,
    wordRanks,
  };
}

function cursorGrapheme(input: PreparedLineClamp, cursor: LayoutCursor): number {
  return (
    (input.segmentGraphemeStarts[cursor.segmentIndex] ?? input.wordRanks.length - 1) +
    cursor.graphemeIndex
  );
}

function displayEndClamp(prepared: PreparedText, kept: number): string {
  if (kept >= prepared.boundaryOffsets.length - 1) return prepared.text;
  return `${prepared.text.slice(0, prepared.boundaryOffsets[kept]).trim()}${ellipsis}`;
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

  const grapheme = cursorGrapheme(input, lastLine.end);
  let boundaries = input.boundaries;
  let kept = input.wordRanks[grapheme] ?? 0;
  if (kept === 0 && grapheme > 0 && boundaries.fallbackBoundaryOffsets) {
    boundaries = {
      boundary: "grapheme",
      boundaryOffsets: boundaries.fallbackBoundaryOffsets,
      text: boundaries.text,
    };
    kept = grapheme;
  }

  return {
    clamped: true,
    text: displayEndClamp(boundaries, kept),
  };
}
