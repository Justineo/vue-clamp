import { describe, expect, it } from "vite-plus/test";
import {
  defaultWarmExpansionLimit,
  estimateColdSearchMaxProbeCount,
  estimateColdSearchProbeCount,
  estimateWarmSearchProbeCount,
  findLargestFittingCount,
  findLastFittingIndex,
  richWarmExpansionLimit,
  warmSearchLocalCoverage,
} from "../src/search.ts";

describe("search cost estimates", () => {
  function actualSearchProbeCount(
    count: number,
    target: number,
    hint?: number | null,
    expansionLimit?: number,
  ): number {
    let probes = 0;

    findLastFittingIndex(
      count,
      (index) => {
        probes += 1;
        return index <= target;
      },
      hint,
      expansionLimit,
    );

    return probes;
  }

  function targetSamples(count: number): number[] {
    const targets = [Number.NEGATIVE_INFINITY];
    for (let target = -1; target <= count; target += 1) {
      targets.push(target);
    }
    targets.push(Number.POSITIVE_INFINITY, Number.NaN);
    return targets;
  }

  it("describes local warm-search coverage from the expansion budget", () => {
    expect(warmSearchLocalCoverage(defaultWarmExpansionLimit)).toBe(3);
    expect(warmSearchLocalCoverage(richWarmExpansionLimit)).toBe(7);
  });

  it("counts a same-rank warm search as a local proof", () => {
    expect(estimateWarmSearchProbeCount(64, 16, 16)).toBe(2);
  });

  it("distinguishes local growth from growth that falls back to binary search", () => {
    expect(estimateWarmSearchProbeCount(64, 16, 18)).toBe(4);
    expect(estimateWarmSearchProbeCount(64, 16, 19)).toBeGreaterThan(
      estimateColdSearchMaxProbeCount(64),
    );
  });

  it("matches the actual cold search probe count across candidate counts", () => {
    for (const count of [0, 1, 2, 3, 4, 5, 8, 16, 17, 31, 64, 127]) {
      for (const target of targetSamples(count)) {
        expect(estimateColdSearchProbeCount(count, target)).toBe(
          actualSearchProbeCount(count, target),
        );
      }
    }
  });

  it("keeps the cold search upper bound above every exact probe count", () => {
    for (const count of [0, 1, 2, 3, 4, 5, 8, 16, 17, 31, 64, 127]) {
      for (const target of targetSamples(count)) {
        expect(estimateColdSearchMaxProbeCount(count)).toBeGreaterThanOrEqual(
          actualSearchProbeCount(count, target),
        );
      }
    }
  });

  it("matches the actual warm search probe count across resize distances", () => {
    for (const count of [0, 1, 2, 3, 4, 5, 8, 16, 17, 31, 64]) {
      const hints = [
        Number.NEGATIVE_INFINITY,
        -3,
        0,
        1,
        Math.floor(count / 2),
        count - 1,
        count + 3,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ];

      for (const hint of hints) {
        for (const target of targetSamples(count)) {
          for (const expansionLimit of [0, 1, 2, 3]) {
            expect(estimateWarmSearchProbeCount(count, hint, target, expansionLimit)).toBe(
              actualSearchProbeCount(count, target, hint, expansionLimit),
            );
          }
        }
      }
    }
  });
});

describe("largest fitting count search", () => {
  it("returns the lower bound without probing empty or single-count ranges", () => {
    const probes: number[] = [];
    const fits = (count: number): boolean => {
      probes.push(count);
      return true;
    };

    expect(findLargestFittingCount(4, 4, fits)).toBe(4);
    expect(findLargestFittingCount(4, 3, fits)).toBe(4);
    expect(probes).toEqual([]);
  });

  it("keeps the no-hint count search on ceil-midpoint probe order", () => {
    const probes: number[] = [];
    const result = findLargestFittingCount(0, 8, (count) => {
      probes.push(count);
      return count <= 5;
    });

    expect(result).toBe(5);
    expect(probes).toEqual([4, 6, 5]);
  });

  it("warm-starts count search from the hinted count", () => {
    const probes: number[] = [];
    const result = findLargestFittingCount(
      10,
      20,
      (count) => {
        probes.push(count);
        return count <= 16;
      },
      15,
    );

    expect(result).toBe(16);
    expect(probes[0]).toBe(15);
  });

  it("preserves the known-safe lower bound if every probed count fails", () => {
    const result = findLargestFittingCount(4, 10, () => false, 8);

    expect(result).toBe(4);
  });
});
