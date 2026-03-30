import { computeClampText, getSource } from "../src/clamp.ts";
import type { Source } from "../src/clamp.ts";
import {
  contentWidth,
  fontShorthand,
  lineHeight,
  measureWidth,
  parsePx,
} from "../src/measurement.ts";
import type { BenchmarkClampInput } from "./types.ts";

const preparedSourceByFixture = new WeakMap<HTMLElement, Source>();

export function runPretextDomClamp(input: BenchmarkClampInput): void {
  const text = input.text.trim();
  const { rootElement, textElement, beforeElement, afterElement } = input.fixture;

  if (text.length === 0 || (input.maxLines === undefined && input.maxHeight === undefined)) {
    textElement.textContent = text;
    return;
  }

  const containerWidth = contentWidth(rootElement);
  const lineHeightValue = lineHeight(textElement, null);
  const fontValue = fontShorthand(getComputedStyle(textElement));
  const resolvedMaxHeight = parsePx(getComputedStyle(rootElement).maxHeight);

  if (containerWidth <= 0 || lineHeightValue <= 0) {
    textElement.textContent = text;
    return;
  }

  const preparedSource = getSource(preparedSourceByFixture.get(rootElement), text, fontValue);
  preparedSourceByFixture.set(rootElement, preparedSource);

  const result = computeClampText({
    source: preparedSource,
    containerWidth,
    lineHeight: lineHeightValue,
    location: input.location,
    ellipsis: input.ellipsis,
    beforeWidth: measureWidth(beforeElement),
    afterWidth: measureWidth(afterElement),
    maxLines: input.maxLines,
    maxHeight: resolvedMaxHeight,
  });

  textElement.textContent = result.displayText;
}
