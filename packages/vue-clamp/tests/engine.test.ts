import { describe, expect, it } from "vite-plus/test";
import { computeClampText, getSource } from "../src/clamp.ts";
import type { Source } from "../src/clamp.ts";
import type { ClampLocation } from "../src/types.ts";

const FONT = "16px Inter";
const LINE_HEIGHT = 20;
const ELLIPSIS = "…";

type RunOptions = {
  text: string;
  font?: string;
  containerWidth?: number;
  lineHeight?: number;
  location?: ClampLocation;
  ellipsis?: string;
  beforeWidth?: number;
  afterWidth?: number;
  maxLines?: number;
  maxHeight?: number;
  source?: Source | null;
};

function run(options: RunOptions) {
  const {
    text,
    font = FONT,
    containerWidth = 24,
    lineHeight = LINE_HEIGHT,
    location = "end",
    ellipsis = ELLIPSIS,
    beforeWidth = 0,
    afterWidth = 0,
    maxLines = 1,
    maxHeight = undefined,
    source: currentSource = null,
  } = options;
  const source = getSource(currentSource, text, font);
  const result = computeClampText({
    source,
    containerWidth,
    lineHeight,
    location,
    ellipsis,
    beforeWidth,
    afterWidth,
    maxLines,
    maxHeight,
  });

  return { source, result };
}

describe("Pretext clamp engine", () => {
  it("reuses the same source for identical trimmed text and font", () => {
    const first = getSource(null, " abc ", FONT);
    const second = getSource(first, "abc", FONT);

    expect(second).toBe(first);
    expect(second.text).toBe("abc");
  });

  it("uses simple one-code-unit slices for ASCII-safe text", () => {
    const source = getSource(null, "Simple ASCII text", FONT);

    expect(source.graphemes).toEqual("Simple ASCII text".split(""));
  });

  it("keeps grapheme clusters intact for grapheme-sensitive text", () => {
    const source = getSource(null, "Family emoji 👨‍👩‍👧‍👦", FONT);

    expect(source.graphemes).toContain("👨‍👩‍👧‍👦");
  });

  it("returns unclamped text when the full text fits within max lines", () => {
    const { result } = run({
      text: "abcdef",
      maxLines: 2,
    });

    expect(result).toEqual({
      clamped: false,
      displayText: "abcdef",
      lineCount: 2,
      maxLines: 2,
    });
  });

  it("clamps at the end for a single-line overflow", () => {
    const { result } = run({
      text: "abcdef",
    });

    expect(result.displayText).toBe("ab…");
    expect(result.clamped).toBe(true);
    expect(result.lineCount).toBe(1);
  });

  it("clamps at the start for a multi-line overflow", () => {
    const { result } = run({
      text: "abcdefg",
      maxLines: 2,
      location: "start",
    });

    expect(result.displayText).toBe("…cdefg");
    expect(result.clamped).toBe(true);
    expect(result.lineCount).toBe(2);
  });

  it("preserves the full odd kept count in middle mode", () => {
    const { result } = run({
      text: "abcdefg",
      maxLines: 2,
      location: "middle",
    });

    expect(result.displayText).toBe("ab…efg");
    expect(result.clamped).toBe(true);
    expect(result.lineCount).toBe(2);
  });

  it("falls back to ellipsis-only when nothing else fits", () => {
    const { result } = run({
      text: "abcdef",
      containerWidth: 8,
    });

    expect(result.displayText).toBe("…");
    expect(result.clamped).toBe(true);
    expect(result.lineCount).toBe(1);
  });

  it("does not split a grapheme cluster when clamping", () => {
    const { result } = run({
      text: "A👨‍👩‍👧‍👦BC",
      containerWidth: 96,
    });

    expect(result.displayText).toBe("A…");
    expect(result.clamped).toBe(true);
  });

  it("reduces the chosen candidate when before width consumes first-line space", () => {
    const { result } = run({
      text: "abcdef",
      maxLines: 2,
      beforeWidth: 8,
    });

    expect(result.displayText).toBe("abcd…");
    expect(result.lineCount).toBe(2);
  });

  it("keeps the after width on the last visible line when it fits", () => {
    const { result } = run({
      text: "abcdefg",
      maxLines: 2,
      afterWidth: 8,
    });

    expect(result.displayText).toBe("abcd…");
    expect(result.lineCount).toBe(2);
  });

  it("budgets before and after widths together", () => {
    const { result } = run({
      text: "abcdefg",
      maxLines: 2,
      beforeWidth: 8,
      afterWidth: 8,
    });

    expect(result.displayText).toBe("abc…");
    expect(result.lineCount).toBe(2);
  });

  it("uses the smaller effective limit when max lines and max height both exist", () => {
    const { result } = run({
      text: "abcdefg",
      lineHeight: 10,
      maxLines: 3,
      maxHeight: 20,
    });

    expect(result.maxLines).toBe(2);
    expect(result.displayText).toBe("abcde…");
    expect(result.lineCount).toBe(2);
  });

  it("reuses the cached result for the exact same effective input", () => {
    const source = getSource(null, "abcdefg", FONT);
    const first = computeClampText({
      source,
      containerWidth: 24,
      lineHeight: LINE_HEIGHT,
      location: "end",
      ellipsis: ELLIPSIS,
      beforeWidth: 0,
      afterWidth: 8,
      maxLines: 2,
      maxHeight: undefined,
    });
    const second = computeClampText({
      source,
      containerWidth: 24,
      lineHeight: LINE_HEIGHT,
      location: "end",
      ellipsis: ELLIPSIS,
      beforeWidth: 0,
      afterWidth: 8,
      maxLines: 2,
      maxHeight: undefined,
    });
    const third = computeClampText({
      source,
      containerWidth: 24,
      lineHeight: LINE_HEIGHT,
      location: "end",
      ellipsis: ELLIPSIS,
      beforeWidth: 0,
      afterWidth: 0,
      maxLines: 2,
      maxHeight: undefined,
    });

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(third.displayText).toBe("abcde…");
  });
});
