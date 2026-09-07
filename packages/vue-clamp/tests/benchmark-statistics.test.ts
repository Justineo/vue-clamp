import { describe, expect, it } from "vite-plus/test";
import { summarizePairedSamples } from "../../../tools/benchmark/src/helpers.ts";

describe("paired benchmark comparisons", () => {
  it("separates a consistent improvement from large shared round-to-round drift", () => {
    expect(summarizePairedSamples([100, 1000, 200, 2000], [95, 995, 195, 1995])).toMatchObject({
      samples: 4,
      meanDelta: -5,
      lower95: -5,
      upper95: -5,
      direction: "lower",
    });
  });

  it("does not classify noisy differences or identical samples as equivalent or slower", () => {
    const noisy = summarizePairedSamples([100, 120, 90, 130], [105, 112, 103, 119]);
    expect(noisy.lower95).toBeLessThan(0);
    expect(noisy.upper95).toBeGreaterThan(0);
    expect(noisy.direction).toBe("inconclusive");
    expect(summarizePairedSamples([10, 20], [10, 20]).direction).toBe("inconclusive");
  });

  it("reports absolute added cost without dividing by a zero baseline", () => {
    expect(summarizePairedSamples([0, 0, 0], [2, 2, 2])).toMatchObject({
      meanDelta: 2,
      meanDeltaPercent: null,
      direction: "higher",
    });
  });

  it("rejects unmatched, missing, or non-finite measurements", () => {
    expect(() => summarizePairedSamples([1, 2], [1])).toThrow();
    expect(() => summarizePairedSamples([1], [2])).toThrow();
    expect(() => summarizePairedSamples([1, 2], [1, Number.NaN])).toThrow();
  });
});
