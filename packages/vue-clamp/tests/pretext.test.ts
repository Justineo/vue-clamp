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

  it("supports custom ellipses", () => {
    const prepared = prepareLineClamp("alpha beta gamma", font, { ellipsis: "..." });

    expect(clampPreparedLine(prepared, 96, 1)).toEqual({
      clamped: true,
      text: "alpha...",
    });
  });

  it("supports grapheme boundaries when native clamping cannot", () => {
    const prepared = prepareLineClamp("alphabet", font, {
      boundary: "grapheme",
      ellipsis: "...",
    });

    expect(clampPreparedLine(prepared, 40, 1)).toEqual({
      clamped: true,
      text: "al...",
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

  it("accounts for before and after affix occupancy", () => {
    const prepared = prepareLineClamp("alpha beta gamma delta epsilon", font);
    const plain = clampPreparedLine(prepared, 120, 2);
    const affixed = clampPreparedLine(prepared, 120, 2, 32, 28);

    expect(affixed.clamped).toBe(true);
    expect(affixed.text.endsWith("…")).toBe(true);
    expect(affixed.text.length).toBeLessThan(plain.text.length);
  });

  it("moves an emergency-broken leading token to the next line", () => {
    const prepared = prepareLineClamp("observabilityPlatformBoundary".repeat(6), font);
    const plain = clampPreparedLine(prepared, 180, 3, 0, 32);
    const withBefore = clampPreparedLine(prepared, 180, 3, 40, 32);

    expect(withBefore.clamped).toBe(true);
    expect(withBefore.text.length).toBeLessThanOrEqual(plain.text.length);
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
