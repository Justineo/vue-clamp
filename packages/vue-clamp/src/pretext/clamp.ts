import { layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { displayTextForKeptCount, prepareText } from "../text.ts";

import type { LayoutCursor, PreparedTextWithSegments } from "@chenglou/pretext";
import type { PreparedText } from "../text.ts";

const ellipsis = "…";
const start: LayoutCursor = { graphemeIndex: 0, segmentIndex: 0 };
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export type PreparedLineClamp = {
  readonly boundaries: PreparedText;
  readonly ellipsisWidth: number;
  readonly prepared: PreparedTextWithSegments;
  readonly source: string;
};

type LineClampResult = {
  readonly clamped: boolean;
  readonly text: string;
};

export function prepareLineClamp(source: string, font: string): PreparedLineClamp {
  const prepared = prepareWithSegments(source, font);

  return {
    boundaries: prepareText(prepared.segments.join(""), "word"),
    ellipsisWidth: measureNaturalWidth(prepareWithSegments(ellipsis, font)),
    prepared,
    source,
  };
}

function cursorOffset(prepared: PreparedTextWithSegments, cursor: LayoutCursor): number {
  let offset = 0;
  for (let index = 0; index < cursor.segmentIndex; index += 1) {
    offset += prepared.segments[index]?.length ?? 0;
  }

  const segment = prepared.segments[cursor.segmentIndex];
  if (segment === undefined || cursor.graphemeIndex === 0) return offset;

  let grapheme = 0;
  for (const part of graphemeSegmenter.segment(segment)) {
    if (grapheme === cursor.graphemeIndex) break;
    offset += part.segment.length;
    grapheme += 1;
  }

  return offset;
}

function keptAtOffset(prepared: PreparedText, offset: number): number {
  let low = 0;
  let high = prepared.boundaryOffsets.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((prepared.boundaryOffsets[middle] ?? Number.POSITIVE_INFINITY) <= offset) {
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
  let lastLineStart = start;

  for (let line = 0; line < maxLines; line += 1) {
    const range = layoutNextLineRange(input.prepared, cursor, maxWidth);
    if (range === null) {
      return { clamped: false, text: input.source };
    }

    lastLineStart = range.start;
    cursor = range.end;
  }

  if (layoutNextLineRange(input.prepared, cursor, Number.MAX_SAFE_INTEGER) === null) {
    return { clamped: false, text: input.source };
  }

  const lastLineWidth = maxWidth - input.ellipsisWidth;
  if (lastLineWidth <= 0) {
    return {
      clamped: true,
      text: input.ellipsisWidth <= maxWidth ? ellipsis : "",
    };
  }

  const lastLine = layoutNextLineRange(input.prepared, lastLineStart, lastLineWidth);
  if (lastLine === null || lastLine.width > lastLineWidth + 0.5) {
    return { clamped: true, text: ellipsis };
  }

  const sourceOffset = cursorOffset(input.prepared, lastLine.end);
  let boundaries = input.boundaries;
  let kept = keptAtOffset(boundaries, sourceOffset);
  if (kept === 0 && sourceOffset > 0 && boundaries.fallbackBoundaryOffsets) {
    boundaries = {
      boundary: "grapheme",
      boundaryOffsets: boundaries.fallbackBoundaryOffsets,
      text: boundaries.text,
    };
    kept = keptAtOffset(boundaries, sourceOffset);
  }

  return {
    clamped: true,
    text: displayTextForKeptCount(boundaries, 1, ellipsis, kept),
  };
}
