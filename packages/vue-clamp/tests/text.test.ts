import { describe, expect, it } from "vite-plus/test";
import { displayTextForKeptCount, prepareText, clampTextToFit } from "../src/text.ts";

describe("text helpers", () => {
  it("prepares ascii text as single-code-unit grapheme boundaries", () => {
    expect(prepareText("abc").boundaryOffsets).toEqual([0, 1, 2, 3]);
  });

  it("keeps grapheme clusters intact for emoji", () => {
    const text = "a👨‍👩‍👧‍👦b";
    const { boundaryOffsets } = prepareText(text);
    const graphemes = boundaryOffsets
      .slice(1)
      .map((end, index) => text.slice(boundaryOffsets[index], end));

    expect(graphemes).toEqual(["a", "👨‍👩‍👧‍👦", "b"]);
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

  it("can clamp text at word boundaries", () => {
    const prepared = prepareText("alpha beta gamma", "word");

    expect(displayTextForKeptCount(prepared, 1, "…", 3)).toBe("alpha beta…");
  });

  it("falls back to grapheme boundaries when no word boundary fits", () => {
    const prepared = prepareText("supercalifragilistic", "word");

    expect(
      clampTextToFit({
        ellipsis: "…",
        fits: (text) => text.length <= 8,
        prepared,
        ratio: 1,
      }).text,
    ).toBe("superca…");
  });

  it("can warm-start text fitting near the previous fit", () => {
    const prepared = prepareText("x".repeat(100));
    const coldProbes: number[] = [];
    const warmProbes: number[] = [];
    const fits = (probes: number[]) => (text: string) => {
      probes.push(text.length);
      return text.length <= 43;
    };

    const cold = clampTextToFit({
      ellipsis: "…",
      fits: fits(coldProbes),
      prepared,
      ratio: 1,
    });
    const warm = clampTextToFit({
      ellipsis: "…",
      fits: fits(warmProbes),
      hint: {
        boundaryOffsets: prepared.boundaryOffsets,
        ellipsis: "…",
        kept: 40,
        ratio: 1,
        spacing: "trim",
      },
      prepared,
      ratio: 1,
    });

    expect(cold.kept).toBe(42);
    expect(warm.kept).toBe(42);
    expect(warmProbes[0]).toBe(41);
    expect(warmProbes.length).toBeLessThan(coldProbes.length);
  });

  it("can warm-start text fitting downward from an oversized previous fit", () => {
    const prepared = prepareText("x".repeat(100));
    const probes: number[] = [];
    const result = clampTextToFit({
      ellipsis: "…",
      fits: (text) => {
        probes.push(text.length);
        return text.length <= 37;
      },
      hint: {
        boundaryOffsets: prepared.boundaryOffsets,
        ellipsis: "…",
        kept: 42,
        ratio: 1,
        spacing: "trim",
      },
      prepared,
      ratio: 1,
    });

    expect(result.kept).toBe(36);
    expect(probes[0]).toBe(43);
    expect(probes).toContain(37);
  });

  it("can include the full text as a warm search candidate", () => {
    const prepared = prepareText("abcdef");
    const result = clampTextToFit({
      ellipsis: "…",
      fits: (text) => text.length <= prepared.text.length,
      hint: {
        boundaryOffsets: prepared.boundaryOffsets,
        ellipsis: "…",
        kept: 4,
        ratio: 1,
        spacing: "trim",
      },
      includeFullCandidate: true,
      prepared,
      ratio: 1,
    });

    expect(result).toEqual({
      boundaryOffsets: prepared.boundaryOffsets,
      ellipsis: "…",
      kept: 6,
      ratio: 1,
      spacing: "trim",
      text: "abcdef",
    });
  });

  it("verifies the full candidate when ellipsis breaks monotonic fitting", () => {
    const prepared = prepareText("abci");
    const probes: string[] = [];
    const result = clampTextToFit({
      ellipsis: "…",
      fits: (text) => {
        probes.push(text);
        return text === "abci" || text.length <= 3;
      },
      hint: {
        boundaryOffsets: prepared.boundaryOffsets,
        ellipsis: "…",
        kept: 3,
        ratio: 1,
        spacing: "trim",
      },
      includeFullCandidate: true,
      prepared,
      ratio: 1,
    });

    expect(probes).toContain("abci");
    expect(result.kept).toBe(4);
    expect(result.text).toBe("abci");
  });

  it("does not warm-start text fitting from another spacing mode", () => {
    const prepared = prepareText(" x".repeat(50));
    const coldProbes: string[] = [];
    const staleProbes: string[] = [];
    const fits = (probes: string[]) => (text: string) => {
      probes.push(text);
      return text.length <= 43;
    };

    clampTextToFit({
      ellipsis: "…",
      fits: fits(coldProbes),
      prepared,
      ratio: 1,
      spacing: "preserve-outer",
    });
    clampTextToFit({
      ellipsis: "…",
      fits: fits(staleProbes),
      hint: {
        boundaryOffsets: prepared.boundaryOffsets,
        ellipsis: "…",
        kept: 40,
        ratio: 1,
        spacing: "trim",
      },
      prepared,
      ratio: 1,
      spacing: "preserve-outer",
    });

    expect(staleProbes[0]).toBe(coldProbes[0]);
  });
});
