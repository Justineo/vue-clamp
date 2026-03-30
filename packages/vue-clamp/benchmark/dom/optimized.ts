import type { BenchmarkClampInput } from "../types.ts";

function getDisplayText(
  text: string,
  location: BenchmarkClampInput["location"],
  ellipsis: string,
  offset: number,
): string {
  if (offset >= text.length) {
    return text;
  }

  if (location === "start") {
    return `${ellipsis}${text.slice(-offset).trim()}`;
  }

  if (location === "middle") {
    const prefixCount = Math.floor(offset / 2);
    const suffixCount = offset - prefixCount;
    return `${text.slice(0, prefixCount).trim()}${ellipsis}${text.slice(-suffixCount).trim()}`;
  }

  return `${text.slice(0, offset).trim()}${ellipsis}`;
}

function getLineCount(contentElement: HTMLElement): number {
  const keys = new Set<string>();

  for (const rect of Array.from(contentElement.getClientRects())) {
    keys.add(`${rect.top}/${rect.bottom}`);
  }

  return keys.size;
}

export function runOptimizedLegacyDomClamp(input: BenchmarkClampInput): void {
  const text = input.text.trim();
  const { rootElement, contentElement, textElement } = input.fixture;

  if (text.length === 0 || (input.maxLines === undefined && input.maxHeight === undefined)) {
    textElement.textContent = text;
    return;
  }

  const fitsCache = new Map<number, boolean>();
  let appliedText = textElement.textContent ?? "";

  function applyOffset(offset: number): string {
    const displayText = getDisplayText(text, input.location, input.ellipsis, offset);
    if (displayText !== appliedText) {
      textElement.textContent = displayText;
      appliedText = displayText;
    }

    return displayText;
  }

  function doesFit(offset: number): boolean {
    const cached = fitsCache.get(offset);
    if (cached !== undefined) {
      return cached;
    }

    applyOffset(offset);

    let fits = true;
    if (input.maxHeight !== undefined && rootElement.scrollHeight > rootElement.offsetHeight) {
      fits = false;
    }

    if (fits && input.maxLines !== undefined) {
      fits = getLineCount(contentElement) <= input.maxLines;
    }

    fitsCache.set(offset, fits);
    return fits;
  }

  textElement.textContent = text;
  appliedText = text;

  if (doesFit(text.length)) {
    return;
  }

  let low = 0;
  let high = text.length - 1;
  let bestOffset = 0;

  while (low <= high) {
    const offset = Math.floor((low + high) / 2);

    if (doesFit(offset)) {
      bestOffset = offset;
      low = offset + 1;
    } else {
      high = offset - 1;
    }
  }

  while (bestOffset + 1 <= text.length && doesFit(bestOffset + 1)) {
    bestOffset += 1;
  }

  applyOffset(bestOffset);
}
