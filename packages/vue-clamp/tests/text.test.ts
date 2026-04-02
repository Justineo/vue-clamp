import { describe, expect, it } from "vite-plus/test";
import { displayTextForKeptCount, splitGraphemes } from "../src/text.ts";

describe("text helpers", () => {
  it("splits ascii text into single characters", () => {
    expect(splitGraphemes("abc")).toEqual(["a", "b", "c"]);
  });

  it("keeps grapheme clusters intact for emoji", () => {
    expect(splitGraphemes("a👨‍👩‍👧‍👦b")).toEqual(["a", "👨‍👩‍👧‍👦", "b"]);
  });

  it("builds end-clamped text from a kept grapheme count", () => {
    const text = "abcdef";
    const graphemes = splitGraphemes(text);

    expect(displayTextForKeptCount(text, graphemes, "end", "…", 3)).toBe("abc…");
  });

  it("builds middle-clamped text from a kept grapheme count", () => {
    const text = "abcdef";
    const graphemes = splitGraphemes(text);

    expect(displayTextForKeptCount(text, graphemes, "middle", "…", 4)).toBe("ab…ef");
  });
});
