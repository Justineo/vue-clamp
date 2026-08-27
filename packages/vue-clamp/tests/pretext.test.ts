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
  });
});
