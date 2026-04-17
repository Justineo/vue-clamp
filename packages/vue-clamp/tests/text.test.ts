import { describe, expect, it } from "vite-plus/test";
import { displayTextForKeptCount, prepareText, splitGraphemes } from "../src/text.ts";

describe("text helpers", () => {
  it("splits ascii text into single characters", () => {
    expect(splitGraphemes("abc")).toEqual(["a", "b", "c"]);
  });

  it("keeps grapheme clusters intact for emoji", () => {
    expect(splitGraphemes("a👨‍👩‍👧‍👦b")).toEqual(["a", "👨‍👩‍👧‍👦", "b"]);
  });

  it("builds end-clamped text from a kept grapheme count", () => {
    const prepared = prepareText("abcdef");

    expect(displayTextForKeptCount(prepared, 1, "…", 3)).toBe("abc…");
  });

  it("builds middle-clamped text from a kept grapheme count", () => {
    const prepared = prepareText("abcdef");

    expect(displayTextForKeptCount(prepared, 0.5, "…", 4)).toBe("ab…ef");
  });

  it("builds ratio-clamped text from a kept grapheme count", () => {
    const prepared = prepareText("abcdefgh");

    expect(displayTextForKeptCount(prepared, 0.75, "…", 4)).toBe("abc…h");
  });

  it("can preserve outer spacing for inline split text", () => {
    const prepared = prepareText(" line clamp body");

    expect(displayTextForKeptCount(prepared, 1, "…", 5, "preserve-outer")).toBe(" line…");
  });
});
