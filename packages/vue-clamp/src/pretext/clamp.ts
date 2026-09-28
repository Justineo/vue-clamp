import { layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { prepareText } from "../text.ts";

import type {
  LayoutCursor,
  LayoutLineRange,
  PreparedTextWithSegments,
  PrepareOptions,
} from "@chenglou/pretext";
import type { ClampBoundary } from "../types.ts";
import type { PreparedText } from "../text.ts";

const needsWhitespaceNormalization = /[\t\n\r\f]| {2,}|^ | $/u;
const start: LayoutCursor = { graphemeIndex: 0, segmentIndex: 0 };

type LineClampResult = {
  readonly clamped: boolean;
  readonly text: string;
};

type PreparedLineClamp = {
  readonly boundaries: PreparedText;
  readonly ellipsis: string;
  readonly ellipsisWidth: number;
  readonly prepared: PreparedTextWithSegments;
  readonly segmentBoundaryRanks: readonly number[];
  readonly segmentGraphemeStarts: readonly number[];
  readonly source: string;
};

type PrepareLineClampOptions = PrepareOptions & {
  readonly boundary?: ClampBoundary;
  readonly ellipsis?: string;
};

function measureEllipsis(
  ellipsis: string,
  font: string,
  options: PrepareOptions | undefined,
): number {
  if (ellipsis.length === 0) return 0;

  // Pretext already caches font metrics, and PreparedLineClamp retains this
  // width across resizes. A second global cache would outlive loaded fonts.
  return measureNaturalWidth(prepareWithSegments(ellipsis, font, options));
}

export function prepareLineClamp(
  source: string,
  font: string,
  { boundary = "word", ellipsis = "…", ...options }: PrepareLineClampOptions = {},
): PreparedLineClamp {
  const prepared = prepareWithSegments(source, font, options);
  const normalized = needsWhitespaceNormalization.test(source)
    ? prepared.segments.join("")
    : source;
  const boundaries = prepareText(normalized, boundary);
  const fallbackOffsets = boundaries.fallbackBoundaryOffsets ?? boundaries.boundaryOffsets;
  const segmentGraphemeStarts = Array<number>(prepared.segments.length + 1);
  const segmentBoundaryRanks = Array<number>(prepared.segments.length + 1);
  let fallbackIndex = 0;
  let offset = 0;
  let boundaryRank = 0;

  for (let index = 0; index < prepared.segments.length; index += 1) {
    while ((fallbackOffsets[fallbackIndex] ?? Number.POSITIVE_INFINITY) < offset) {
      fallbackIndex += 1;
    }
    while ((boundaries.boundaryOffsets[boundaryRank + 1] ?? Number.POSITIVE_INFINITY) <= offset) {
      boundaryRank += 1;
    }
    segmentGraphemeStarts[index] = fallbackIndex;
    segmentBoundaryRanks[index] = boundaryRank;
    offset += prepared.segments[index]?.length ?? 0;
  }
  segmentGraphemeStarts[prepared.segments.length] = fallbackOffsets.length - 1;
  segmentBoundaryRanks[prepared.segments.length] = boundaries.boundaryOffsets.length - 1;

  return {
    boundaries,
    ellipsis,
    ellipsisWidth: measureEllipsis(ellipsis, font, options),
    prepared,
    segmentBoundaryRanks,
    segmentGraphemeStarts,
    source,
  };
}

function browserLineEnd(line: LayoutLineRange, hasBefore: boolean): LayoutCursor {
  if (!hasBefore || line.end.graphemeIndex === 0) return line.end;

  // `overflow-wrap: break-word` first moves an unbreakable token to a fresh
  // line. Pretext can emergency-break it into the space after an atomic
  // leading affix, so keep only the complete segments from that first line.
  return {
    graphemeIndex: 0,
    segmentIndex: line.end.segmentIndex,
  };
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
  beforeWidth = 0,
  afterWidth = 0,
): LineClampResult {
  if (input.source.length === 0 || maxLines < 1) {
    return { clamped: false, text: input.source };
  }
  if (maxWidth <= 0) return { clamped: true, text: "" };

  const before = Math.max(0, beforeWidth);
  const after = Math.max(0, afterWidth);
  let cursor = start;
  let lastLineWidth = maxWidth;

  for (let line = 0; line < maxLines; line += 1) {
    lastLineWidth = line === 0 ? maxWidth - before : maxWidth;
    if (lastLineWidth <= 0) {
      if (line < maxLines - 1) continue;
      break;
    }

    const range = layoutNextLineRange(input.prepared, cursor, lastLineWidth);
    if (range === null) {
      return after <= maxWidth + 0.5
        ? { clamped: false, text: input.source }
        : { clamped: true, text: "" };
    }

    // The line walker must advance even when one grapheme exceeds the width.
    // Spare lines cannot make that grapheme fit, except when a leading affix
    // leaves room to retry it on a fresh, full-width line.
    if (range.width > lastLineWidth + 0.5) {
      if (line === 0 && before > 0 && line < maxLines - 1) continue;
      break;
    }

    const end = browserLineEnd(range, line === 0 && before > 0);
    const consumed = end === range.end && range.end.segmentIndex >= input.prepared.segments.length;
    if (consumed) {
      if (range.width + after <= lastLineWidth + 0.5 || line < maxLines - 1) {
        return { clamped: false, text: input.source };
      }
    }

    if (line === maxLines - 1) break;
    cursor = end;
  }

  const reservedWidth = input.ellipsisWidth + after;
  const availableWidth = lastLineWidth - reservedWidth;
  if (availableWidth <= 0) {
    return {
      clamped: true,
      text: reservedWidth <= lastLineWidth + 0.5 ? input.ellipsis : "",
    };
  }

  const lastLine = layoutNextLineRange(input.prepared, cursor, availableWidth);
  if (lastLine === null || lastLine.width + reservedWidth > lastLineWidth + 0.5) {
    return { clamped: true, text: input.ellipsis };
  }

  const { graphemeIndex, segmentIndex } = lastLine.end;
  const grapheme = input.segmentGraphemeStarts[segmentIndex]! + graphemeIndex;
  const { boundaries } = input;
  let offsets = boundaries.boundaryOffsets;
  let kept = input.segmentBoundaryRanks[segmentIndex]!;
  if (graphemeIndex > 0) {
    const fallbackOffsets = boundaries.fallbackBoundaryOffsets ?? boundaries.boundaryOffsets;
    const segmentEnd = fallbackOffsets[input.segmentGraphemeStarts[segmentIndex + 1]!]!;
    if ((boundaries.boundaryOffsets[kept + 1] ?? Number.POSITIVE_INFINITY) < segmentEnd) {
      kept = keptAtOffset(
        boundaries.boundaryOffsets,
        fallbackOffsets[grapheme]!,
        kept,
        input.segmentBoundaryRanks[segmentIndex + 1]!,
      );
    }
  }
  if (kept === 0 && grapheme > 0 && boundaries.fallbackBoundaryOffsets) {
    offsets = boundaries.fallbackBoundaryOffsets;
    kept = grapheme;
  }

  return {
    clamped: true,
    text:
      kept >= offsets.length - 1
        ? boundaries.text
        : `${boundaries.text.slice(0, offsets[kept]).trim()}${input.ellipsis}`,
  };
}
