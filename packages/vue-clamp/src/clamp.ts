import { layout, layoutNextLine, prepareWithSegments, walkLineRanges } from "@chenglou/pretext";
import type { ClampLocation } from "./types.ts";

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

const lineStart = {
  segmentIndex: 0,
  graphemeIndex: 0,
};

type Prepared = ReturnType<typeof prepareWithSegments>;
type Input = {
  source: Source;
  containerWidth: number;
  lineHeight: number;
  location: ClampLocation;
  ellipsis: string;
  beforeWidth: number;
  afterWidth: number;
  maxLines: number | undefined;
  maxHeight: number | undefined;
};
type CachedInput = Omit<Input, "source">;
type Result = {
  clamped: boolean;
  displayText: string;
  lineCount: number;
  maxLines: number | null;
};
type Candidate = {
  displayText: string;
  prepared: Prepared;
};

export interface Source {
  text: string;
  font: string;
  prepared: Prepared;
  graphemes: string[];
  candidateCache: Map<string, Candidate>;
  last: {
    input: CachedInput;
    result: Result;
  } | null;
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

function splitGraphemes(text: string): string[] {
  if (isAsciiSafe(text)) {
    return text.split("");
  }

  return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
}

function join(graphemes: string[], start: number, end: number): string {
  return graphemes.slice(start, end).join("");
}

function positive(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function resolveMaxLines(
  maxLines: number | undefined,
  maxHeight: number | undefined,
  lineHeight: number,
): number | null {
  const limits: number[] = [];
  const lines = positive(maxLines);
  if (lines !== null) {
    limits.push(Math.max(1, Math.floor(lines)));
  }

  const height = positive(maxHeight);
  if (height !== null && lineHeight > 0) {
    limits.push(Math.max(1, Math.floor(height / lineHeight)));
  }

  if (limits.length === 0) {
    return null;
  }

  return Math.max(1, Math.min(...limits));
}

export function getSource(current: Source | null | undefined, text: string, font: string): Source {
  const normalizedText = text.trim();
  if (current && current.text === normalizedText && current.font === font) {
    return current;
  }

  return {
    text: normalizedText,
    font,
    prepared: prepareWithSegments(normalizedText, font),
    graphemes: splitGraphemes(normalizedText),
    candidateCache: new Map(),
    last: null,
  };
}

function sameInput(left: CachedInput, right: CachedInput): boolean {
  return (
    left.containerWidth === right.containerWidth &&
    left.lineHeight === right.lineHeight &&
    left.location === right.location &&
    left.ellipsis === right.ellipsis &&
    left.beforeWidth === right.beforeWidth &&
    left.afterWidth === right.afterWidth &&
    left.maxLines === right.maxLines &&
    left.maxHeight === right.maxHeight
  );
}

function remember(source: Source, input: CachedInput, result: Result): Result {
  source.last = {
    input,
    result,
  };

  return result;
}

function candidateText(
  graphemes: string[],
  location: ClampLocation,
  ellipsis: string,
  kept: number,
): string {
  if (location === "start") {
    return `${ellipsis}${join(graphemes, graphemes.length - kept, graphemes.length).trim()}`;
  }

  if (location === "middle") {
    const prefix = Math.floor(kept / 2);
    const suffix = kept - prefix;
    return `${join(graphemes, 0, prefix).trim()}${ellipsis}${join(
      graphemes,
      graphemes.length - suffix,
      graphemes.length,
    ).trim()}`;
  }

  return `${join(graphemes, 0, kept).trim()}${ellipsis}`;
}

function candidateKey(location: ClampLocation, ellipsis: string, kept: number): string {
  return `${location}\u0000${ellipsis}\u0000${kept}`;
}

function preparedCandidate(
  source: Source,
  location: ClampLocation,
  ellipsis: string,
  kept: number,
): Candidate {
  const key = candidateKey(location, ellipsis, kept);
  const cached = source.candidateCache.get(key);
  if (cached) {
    return cached;
  }

  const displayText = candidateText(source.graphemes, location, ellipsis, kept);
  const next: Candidate = {
    displayText,
    prepared: prepareWithSegments(displayText, source.font),
  };
  source.candidateCache.set(key, next);
  return next;
}

function applyAfterWidth(
  lines: number,
  lineWidth: number,
  containerWidth: number,
  afterWidth: number,
): number {
  if (afterWidth <= 0) {
    return lines;
  }

  if (lines === 0) {
    return 1;
  }

  if (lineWidth + afterWidth <= containerWidth) {
    return lines;
  }

  return lines + 1;
}

function countWithBefore(
  prepared: Prepared,
  containerWidth: number,
  beforeWidth: number,
): {
  lineCount: number;
  lineWidth: number;
} {
  let cursor = lineStart;
  let lineCount = 1;
  let lineWidth = beforeWidth;
  let firstTextLine = true;
  const shareFirstLine = beforeWidth < containerWidth;
  const firstLineWidth = Math.max(containerWidth - beforeWidth, 0);

  while (true) {
    let maxWidth = containerWidth;
    if (firstTextLine && shareFirstLine) {
      maxWidth = firstLineWidth;
    }

    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (line === null) {
      break;
    }

    if (firstTextLine && shareFirstLine) {
      lineWidth += line.width;
    } else {
      lineCount += 1;
      lineWidth = line.width;
    }

    cursor = line.end;
    firstTextLine = false;
  }

  return {
    lineCount,
    lineWidth,
  };
}

function countLines(
  prepared: Prepared,
  containerWidth: number,
  lineHeight: number,
  beforeWidth: number,
  afterWidth: number,
): number {
  if (beforeWidth <= 0 && afterWidth <= 0) {
    return layout(prepared, containerWidth, lineHeight).lineCount;
  }

  if (beforeWidth <= 0) {
    let lineCount = 0;
    let lineWidth = 0;

    walkLineRanges(prepared, containerWidth, (line) => {
      lineCount += 1;
      lineWidth = line.width;
    });

    return applyAfterWidth(lineCount, lineWidth, containerWidth, afterWidth);
  }

  const measured = countWithBefore(prepared, containerWidth, beforeWidth);
  return applyAfterWidth(measured.lineCount, measured.lineWidth, containerWidth, afterWidth);
}

export function computeClampText(input: Input): Result {
  const { source, ...nextInput } = input;
  const {
    afterWidth,
    beforeWidth,
    containerWidth,
    ellipsis,
    lineHeight,
    location,
    maxHeight,
    maxLines,
  } = nextInput;

  const cached = source.last;
  if (cached && sameInput(cached.input, nextInput)) {
    return cached.result;
  }

  const count = (prepared: Prepared): number =>
    countLines(prepared, containerWidth, lineHeight, beforeWidth, afterWidth);

  const text = source.text;
  const limit = resolveMaxLines(maxLines, maxHeight, lineHeight);

  if (text.length === 0 || limit === null || containerWidth <= 0 || lineHeight <= 0) {
    return remember(source, nextInput, {
      clamped: false,
      displayText: text,
      lineCount: text.length === 0 ? 0 : count(source.prepared),
      maxLines: limit,
    });
  }

  const fullLineCount = count(source.prepared);
  if (fullLineCount <= limit) {
    return remember(source, nextInput, {
      clamped: false,
      displayText: text,
      lineCount: fullLineCount,
      maxLines: limit,
    });
  }

  let low = 0;
  let high = source.graphemes.length - 1;
  let best = 0;

  while (low <= high) {
    const kept = Math.floor((low + high) / 2);
    if (count(preparedCandidate(source, location, ellipsis, kept).prepared) <= limit) {
      best = kept;
      low = kept + 1;
    } else {
      high = kept - 1;
    }
  }

  const candidate = preparedCandidate(source, location, ellipsis, best);
  return remember(source, nextInput, {
    clamped: true,
    displayText: candidate.displayText,
    lineCount: count(candidate.prepared),
    maxLines: limit,
  });
}
