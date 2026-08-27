import { describe, expect, it } from "vite-plus/test";
import { clampPreparedLine, prepareLineClamp } from "../src/pretext/clamp.ts";

const font = "16px Arial";

describe("Pretext line clamping", () => {
  it("preserves source text that fits", () => {
    const prepared = prepareLineClamp("alpha beta", font);

    expect(clampPreparedLine(prepared, 200, 1)).toEqual({
      clamped: false,
      text: "alpha beta",
    });
  });

  it("materializes an end-clamped prefix", () => {
    const prepared = prepareLineClamp("alpha beta gamma", font);

    expect(clampPreparedLine(prepared, 96, 1)).toEqual({
      clamped: true,
      text: "alpha beta…",
    });
  });

  it("falls back inside a word when necessary", () => {
    const prepared = prepareLineClamp("alphabet", font);

    expect(clampPreparedLine(prepared, 40, 1)).toEqual({
      clamped: true,
      text: "alph…",
    });
  });

  it("uses only what can fit at very narrow widths", () => {
    const prepared = prepareLineClamp("alpha", font);

    expect(clampPreparedLine(prepared, 12, 1)).toEqual({
      clamped: true,
      text: "…",
    });
    expect(clampPreparedLine(prepared, 4, 1)).toEqual({
      clamped: true,
      text: "",
    });
    expect(clampPreparedLine(prepared, 0, 1)).toEqual({
      clamped: true,
      text: "",
    });
  });

  it("never cuts through a composed grapheme", () => {
    const source = "e\u0301👩‍🚀".repeat(12);
    const prepared = prepareLineClamp(source, font);
    const prefixes = new Set([""]);
    let prefix = "";
    for (const part of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(source)) {
      prefix += part.segment;
      prefixes.add(prefix);
    }

    for (let width = 8; width <= 160; width += 4) {
      const result = clampPreparedLine(prepared, width, 1);
      const visiblePrefix = result.text.endsWith("…") ? result.text.slice(0, -1) : result.text;
      expect(prefixes.has(visiblePrefix)).toBe(true);
    }
  });

  it("uses Pretext whitespace normalization for boundary mapping", () => {
    const prepared = prepareLineClamp("  alpha\t\n beta  ", font);

    expect(prepared.boundaries.text).toBe("alpha beta");
    expect(prepared.prepared.segments.join("")).toBe(prepared.boundaries.text);
  });
});
