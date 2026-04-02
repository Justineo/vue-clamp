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
