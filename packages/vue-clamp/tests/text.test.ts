import { describe, expect, it } from "vite-plus/test";
import {
  displayTextForKeptCount,
  prepareText,
  prepareSharedText,
  clampTextToFit,
} from "../src/text.ts";

describe("text helpers", () => {
  it("prepares ASCII grapheme boundaries", () => {
    expect(prepareText("abc").boundaryOffsets).toEqual([0, 1, 2, 3]);
  });

  it("matches native boundaries across writing systems and composed sequences", () => {
    const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const words = new Intl.Segmenter(undefined, { granularity: "word" });
    const alphabet = "A\t\n、。，㐀䶿一鿿";
    for (const text of [
      "ASCII text\twith a line\nbreak",
      "A\r\nB",
      "a\u0301b",
      alphabet,
      "Voilà Καλημέρα Быстрая 한글 かな مرحبا ܐܒܓ",
      alphabet + "中\uFE0F文",
      alphabet + "中\u{E0100}文",
      alphabet + "a\u0301",
      alphabet + "\r\n",
      alphabet + "👩🏽‍💻🇨🇳\u{20000}",
      alphabet + "\u0600中",
      alphabet + "\uD800",
    ]) {
      const fallback = [
        0,
        ...Array.from(graphemes.segment(text), (part) => part.index + part.segment.length),
      ];
      const wordOffsets = [
        0,
        ...Array.from(words.segment(text), (part) => part.index + part.segment.length).filter(
          (offset) => fallback.includes(offset),
        ),
      ];
      for (const boundary of ["word", "grapheme"] as const) {
        for (const prepare of [prepareText, prepareSharedText]) {
          const prepared = prepare(text, boundary);
          expect(prepared.boundaryOffsets).toEqual(boundary === "word" ? wordOffsets : fallback);
          if (boundary === "word") expect(prepared.fallbackBoundaryOffsets).toEqual(fallback);
        }
      }
    }
  });

  it("matches native boundaries throughout the compact single-unit range", () => {
    const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const words = new Intl.Segmenter(undefined, { granularity: "word" });
    const alphabet = Array.from({ length: 0x300 - 0x20 }, (_, index) =>
      String.fromCharCode(index + 0x20),
    ).join("");
    const sources = [
      "Café déjà prêt, Straße, smörgås, niño, œuvre, Łódź",
      "\u02e5\u02e9\u02e5\u02e9",
      "\u02ff\u0300",
      "\u00ad\u0301",
      "é\r\nœ",
      "e\u0301 o\u0308",
      "l’œuvre — déjà…",
      "é👩🏽‍💻œ",
    ];
    for (let start = 0; start < alphabet.length; start += 32) {
      const chunk = alphabet.slice(start, start + 32);
      sources.push("A\t\n" + chunk + chunk.split("").reverse().join("") + "Z");
    }
    for (const text of sources) {
      const fallback = [
        0,
        ...Array.from(graphemes.segment(text), (part) => part.index + part.segment.length),
      ];
      const wordOffsets = [
        0,
        ...Array.from(words.segment(text), (part) => part.index + part.segment.length).filter(
          (offset) => fallback.includes(offset),
        ),
      ];
      for (const prepare of [prepareText, prepareSharedText]) {
        expect(prepare(text).boundaryOffsets).toEqual(fallback);
        const prepared = prepare(text, "word");
        expect(prepared.boundaryOffsets).toEqual(wordOffsets);
        expect(prepared.fallbackBoundaryOffsets).toEqual(fallback);
      }
    }
  });

  it("keeps deferred word boundaries and fallbacks identical across mixed Unicode sources", () => {
    const parts = [
      "word ",
      "👩🏽‍💻",
      "👨‍👩‍👧‍👦",
      "🇨🇳",
      "é",
      "क्‍ष",
      "中文",
      "العربية",
      "\r\n",
      "\t",
      "\u0000",
      "\ud800",
      "\udc00",
      "️",
      "‍",
    ];
    let seed = 329;
    for (let sample = 0; sample < 128; sample += 1) {
      let text = "";
      for (let part = 0; part < 12; part += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        text += parts[seed % parts.length];
      }
      const expected = prepareText(text, "word");
      const actual = prepareSharedText(text, "word");
      expect(actual.boundaryOffsets).toEqual(expected.boundaryOffsets);
      expect(actual.fallbackBoundaryOffsets).toEqual(expected.fallbackBoundaryOffsets);
      for (const ratio of [0, 0.5, 1]) {
        const input = { ellipsis: "…", ratio, fits: (candidate: string) => candidate.length <= 9 };
        expect(clampTextToFit({ ...input, prepared: actual })).toEqual(
          clampTextToFit({ ...input, prepared: expected }),
        );
      }
    }
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

it("shares only identical source and boundary", () => {
  const a = prepareSharedText("A family 👨‍👩‍👧‍👦 café é 中文", "word");
  expect(prepareSharedText(a.text, "word")).toBe(a);
  expect(a.boundaryOffsets).toEqual(prepareText(a.text, "word").boundaryOffsets);
  expect(a.fallbackBoundaryOffsets).toEqual(prepareText(a.text, "word").fallbackBoundaryOffsets);
  const b = prepareSharedText(a.text, "grapheme");
  expect(b).not.toBe(a);
  expect(b.boundaryOffsets).toEqual(prepareText(a.text, "grapheme").boundaryOffsets);
});
it("does not retain oversized inputs and evicts the preceding entry", () => {
  const a = prepareSharedText("previous small entry", "word"),
    text = "中".repeat(8193);
  const big = prepareSharedText(text, "word");
  expect(prepareSharedText(text, "word")).not.toBe(big);
  expect(prepareSharedText(a.text, "word")).not.toBe(a);
});
it("includes the size boundary and separates successive sources", () => {
  const text = "a".repeat(8192),
    a = prepareSharedText(text);
  expect(prepareSharedText(text)).toBe(a);
  const b = prepareSharedText(text + "b");
  expect(b).not.toBe(a);
  expect(b.text).toBe(text + "b");
});

it("reuses four interleaved sources and evicts the least recently used preparation", () => {
  prepareSharedText("x".repeat(8193));
  const entries = ["a", "b", "c", "d"].map((text) => prepareSharedText(text, "word"));
  for (const entry of entries) expect(prepareSharedText(entry.text, "word")).toBe(entry);
  expect(prepareSharedText("a", "word")).toBe(entries[0]);
  prepareSharedText("e", "word");
  expect(prepareSharedText("a", "word")).toBe(entries[0]);
  expect(prepareSharedText("c", "word")).toBe(entries[2]);
  expect(prepareSharedText("d", "word")).toBe(entries[3]);
  expect(prepareSharedText("b", "word")).not.toBe(entries[1]);
});

it("bounds the combined source budget across preparation entries", () => {
  prepareSharedText("x".repeat(8193));
  const a = prepareSharedText("a".repeat(4096));
  const b = prepareSharedText("b".repeat(4096));
  expect(prepareSharedText(a.text)).toBe(a);
  expect(prepareSharedText(b.text)).toBe(b);
  const small = prepareSharedText("c");
  expect(prepareSharedText(b.text)).toBe(b);
  expect(prepareSharedText(small.text)).toBe(small);
  expect(prepareSharedText(a.text)).not.toBe(a);
});
