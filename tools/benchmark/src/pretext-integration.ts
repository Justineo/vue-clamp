import { layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { displayTextForKeptCount } from "../../../packages/vue-clamp/src/text.ts";

import type {
  LayoutCursor,
  PreparedTextWithSegments as PretextPreparedText,
  PrepareOptions,
} from "@chenglou/pretext";
import type { PreparedText, TextClampHint } from "../../../packages/vue-clamp/src/text.ts";

export type PretextClampConfig = {
  readonly ellipsis: string;
  readonly firstLineReserve?: number | undefined;
  readonly font: string;
  readonly lastLineReserve?: number | undefined;
  readonly letterSpacing?: number | undefined;
  readonly lineLimit: number;
  readonly maxWidth: number;
  readonly wordBreak?: "normal" | "keep-all" | undefined;
};

export type PreparedPretextClamp = {
  readonly ellipsisWidth: number;
  readonly prepared: PretextPreparedText;
  readonly source: string;
};

export type PretextClampPrediction = {
  readonly kept: number;
  readonly sourceOffset: number;
  readonly supported: true;
};

export type UnsupportedPretextClampPrediction = {
  readonly reason: string;
  readonly supported: false;
};

export type PretextClampPredictionResult =
  | PretextClampPrediction
  | UnsupportedPretextClampPrediction;

export type PurePretextClampResult =
  | (PretextClampPrediction & { readonly text: string })
  | UnsupportedPretextClampPrediction;

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function prepareOptions(config: PretextClampConfig): PrepareOptions {
  return {
    letterSpacing: config.letterSpacing ?? 0,
    whiteSpace: "normal",
    wordBreak: config.wordBreak ?? "normal",
  };
}

export function preparePretextClamp(
  source: string,
  config: PretextClampConfig,
): PreparedPretextClamp {
  const options = prepareOptions(config);
  const prepared = prepareWithSegments(source, config.font, options);
  const ellipsis = prepareWithSegments(config.ellipsis, config.font, options);

  return {
    ellipsisWidth: measureNaturalWidth(ellipsis),
    prepared,
    source,
  };
}

function nextCursor(
  prepared: PretextPreparedText,
  cursor: LayoutCursor,
  width: number,
): LayoutCursor | null {
  const range = layoutNextLineRange(prepared, cursor, Math.max(0.01, width));
  return range?.end ?? null;
}

function cursorAtEnd(prepared: PretextPreparedText, cursor: LayoutCursor): boolean {
  return layoutNextLineRange(prepared, cursor, Number.MAX_SAFE_INTEGER) === null;
}

function walkLines(
  prepared: PretextPreparedText,
  maxWidth: number,
  lineLimit: number,
  firstLineReserve: number,
  lastLineReserve: number,
): LayoutCursor | null {
  let cursor: LayoutCursor = { graphemeIndex: 0, segmentIndex: 0 };

  for (let line = 0; line < lineLimit; line += 1) {
    const reserve =
      (line === 0 ? firstLineReserve : 0) + (line === lineLimit - 1 ? lastLineReserve : 0);
    const next = nextCursor(prepared, cursor, maxWidth - reserve);
    if (next === null) {
      return cursor;
    }

    cursor = next;
    if (cursorAtEnd(prepared, cursor)) {
      return cursor;
    }
  }

  return cursor;
}

function cursorOffset(prepared: PretextPreparedText, cursor: LayoutCursor): number | null {
  let offset = 0;

  for (let index = 0; index < cursor.segmentIndex; index += 1) {
    offset += prepared.segments[index]?.length ?? 0;
  }

  const segment = prepared.segments[cursor.segmentIndex];
  if (segment === undefined) {
    return cursor.segmentIndex >= prepared.segments.length ? offset : null;
  }

  if (cursor.graphemeIndex <= 0) {
    return offset;
  }

  let graphemeCount = 0;
  for (const part of graphemeSegmenter.segment(segment)) {
    if (graphemeCount >= cursor.graphemeIndex) {
      break;
    }

    offset += part.segment.length;
    graphemeCount += 1;
  }

  return graphemeCount === cursor.graphemeIndex ? offset : null;
}

function keptForOffset(prepared: PreparedText, offset: number): number {
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

export function predictPretextEndClamp(
  preparedText: PreparedText,
  pretext: PreparedPretextClamp,
  config: PretextClampConfig,
): PretextClampPredictionResult {
  if (config.lineLimit < 1 || config.maxWidth <= 0) {
    return { reason: "invalid-capacity", supported: false };
  }

  if (pretext.prepared.segments.join("") !== pretext.source) {
    return { reason: "normalized-source-cannot-map-to-raw-offsets", supported: false };
  }

  const firstReserve = Math.max(0, config.firstLineReserve ?? 0);
  const lastReserve = Math.max(0, config.lastLineReserve ?? 0);
  const fullCursor = walkLines(
    pretext.prepared,
    config.maxWidth,
    config.lineLimit,
    firstReserve,
    lastReserve,
  );

  if (fullCursor !== null && cursorAtEnd(pretext.prepared, fullCursor)) {
    const kept = preparedText.boundaryOffsets.length - 1;
    return { kept, sourceOffset: pretext.source.length, supported: true };
  }

  const clampedCursor = walkLines(
    pretext.prepared,
    config.maxWidth,
    config.lineLimit,
    firstReserve,
    lastReserve + pretext.ellipsisWidth,
  );
  if (clampedCursor === null) {
    return { kept: 0, sourceOffset: 0, supported: true };
  }

  const sourceOffset = cursorOffset(pretext.prepared, clampedCursor);
  if (sourceOffset === null) {
    return { reason: "pretext-cursor-cannot-map-to-source", supported: false };
  }

  return {
    kept: keptForOffset(preparedText, sourceOffset),
    sourceOffset,
    supported: true,
  };
}

export function clampPurePretextEndText(
  preparedText: PreparedText,
  pretext: PreparedPretextClamp,
  config: PretextClampConfig,
): PurePretextClampResult {
  const prediction = predictPretextEndClamp(preparedText, pretext, config);
  if (!prediction.supported) {
    return prediction;
  }

  const fallbackPrepared =
    preparedText.boundary === "word" &&
    prediction.kept === 0 &&
    prediction.sourceOffset > 0 &&
    preparedText.fallbackBoundaryOffsets
      ? {
          boundary: "grapheme" as const,
          boundaryOffsets: preparedText.fallbackBoundaryOffsets,
          text: preparedText.text,
        }
      : null;
  const outputPrepared = fallbackPrepared ?? preparedText;
  const kept = fallbackPrepared
    ? keptForOffset(fallbackPrepared, prediction.sourceOffset)
    : prediction.kept;

  return {
    ...prediction,
    kept,
    text: displayTextForKeptCount(outputPrepared, 1, config.ellipsis, kept),
  };
}

export function pretextPredictionHint(
  preparedText: PreparedText,
  prediction: PretextClampPrediction,
  ellipsis: string,
): TextClampHint {
  return {
    boundaryOffsets: preparedText.boundaryOffsets,
    ellipsis,
    kept: prediction.kept,
    ratio: 1,
    spacing: "trim",
  };
}
