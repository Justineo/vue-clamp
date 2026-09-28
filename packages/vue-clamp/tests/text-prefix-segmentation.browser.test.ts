import { describe, expect, it } from "vite-plus/test";
import { prepareSharedText, prepareText } from "../src/text.ts";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const words = new Intl.Segmenter(undefined, { granularity: "word" });

function expectNativeBoundaries(text: string): void {
  // Segment the complete source so the oracle retains the engine's own context.
  const fallback = [
    0,
    ...Array.from(graphemes.segment(text), (part) => part.index + part.segment.length),
  ];
  const graphemeEnds = new Set(fallback);
  const wordOffsets = [
    0,
    ...Array.from(words.segment(text), (part) => part.index + part.segment.length).filter(
      (offset) => graphemeEnds.has(offset),
    ),
  ];

  for (const [name, prepare] of [
    ["eager", prepareText],
    ["shared", prepareSharedText],
  ] as const) {
    for (const boundary of ["word", "grapheme"] as const) {
      const prepared = prepare(text, boundary);
      expect(prepared.boundaryOffsets, `${name}/${boundary}`).toEqual(
        boundary === "word" ? wordOffsets : fallback,
      );
      if (boundary === "word") {
        expect(prepared.fallbackBoundaryOffsets, `${name}/fallback`).toEqual(fallback);
      }
    }
  }
}

describe("native boundaries around compact-unit prefixes", () => {
  it.each([0, 63, 64, 65, 128])("keeps combining context after %i safe units", (length) => {
    expectNativeBoundaries("a".repeat(length) + "\u0301\u0308" + "b".repeat(128));
  });

  it.each([
    ["Prepend", "\u0600"],
    ["CRLF", "\r\n"],
    ["joined admitted pictographs", "\u200d®"],
    ["joined emoji", "\u200d👩🏽‍💻"],
    ["Indic conjunct", "क्‍ष"],
    ["private-use characters", "\uf860a\uf865"],
  ])("keeps native %s boundaries between long safe runs", (_name, context) => {
    // © is admitted, but can join the following ZWJ sequence into one grapheme.
    expectNativeBoundaries("a".repeat(63) + "©" + context + "b".repeat(128));
  });

  it("preserves boundaries when only a later safe run is long", () => {
    expectNativeBoundaries("a".repeat(63) + "中" + "b".repeat(128) + "\u0301 tail");
  });

  it("preserves empty and entirely admitted sources", () => {
    expectNativeBoundaries("");
    expectNativeBoundaries("Café déjà prêt ©®\t\n".repeat(8));
  });
});
