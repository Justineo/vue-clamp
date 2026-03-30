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

function isOverflow(
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  maxLines: number | undefined,
  maxHeight: number | string | undefined,
): boolean {
  if (maxLines !== undefined && getLineCount(contentElement) > maxLines) {
    return true;
  }

  if (maxHeight !== undefined && rootElement.scrollHeight > rootElement.offsetHeight) {
    return true;
  }

  return false;
}

export function runLegacyDomClamp(input: BenchmarkClampInput): void {
  const text = input.text.trim();
  const { rootElement, contentElement, textElement } = input.fixture;

  if (text.length === 0 || (input.maxLines === undefined && input.maxHeight === undefined)) {
    textElement.textContent = text;
    return;
  }

  let offset = text.length;

  function applyOffset(nextOffset: number): void {
    offset = Math.max(0, Math.min(text.length, nextOffset));
    textElement.textContent = getDisplayText(text, input.location, input.ellipsis, offset);
  }

  function moveOffset(step: number): void {
    applyOffset(offset + step);
  }

  function fill(): void {
    while (
      (!isOverflow(rootElement, contentElement, input.maxLines, input.maxHeight) ||
        getLineCount(contentElement) < 2) &&
      offset < text.length
    ) {
      moveOffset(1);
    }
  }

  function clamp(): void {
    while (
      isOverflow(rootElement, contentElement, input.maxLines, input.maxHeight) &&
      getLineCount(contentElement) > 1 &&
      offset > 0
    ) {
      moveOffset(-1);
    }
  }

  function stepToFit(): void {
    fill();
    clamp();
  }

  function search(from = 0, to = offset): void {
    if (to - from <= 3) {
      stepToFit();
      return;
    }

    const target = Math.floor((to + from) / 2);
    applyOffset(target);

    if (isOverflow(rootElement, contentElement, input.maxLines, input.maxHeight)) {
      search(from, target);
      return;
    }

    search(target, to);
  }

  applyOffset(text.length);

  if (isOverflow(rootElement, contentElement, input.maxLines, input.maxHeight)) {
    search();
  }

  textElement.textContent =
    offset !== text.length ? getDisplayText(text, input.location, input.ellipsis, offset) : text;
}
