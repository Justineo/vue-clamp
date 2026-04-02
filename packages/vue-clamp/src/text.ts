import type { ClampLocation } from "./types.ts";

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function isAsciiSafe(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code < 0x20 || code > 0x7e) && code !== 0x09 && code !== 0x0a) {
      return false;
    }
  }

  return true;
}

function join(graphemes: string[], start: number, end: number): string {
  return graphemes.slice(start, end).join("");
}

export function splitGraphemes(text: string): string[] {
  if (isAsciiSafe(text)) {
    return text.split("");
  }

  return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
}

export function displayTextForKeptCount(
  text: string,
  graphemes: string[],
  location: ClampLocation,
  ellipsis: string,
  kept: number,
): string {
  if (kept >= graphemes.length) {
    return text;
  }

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
