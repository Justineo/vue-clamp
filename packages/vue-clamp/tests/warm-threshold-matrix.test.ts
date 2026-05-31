import { describe, expect, it } from "vite-plus/test";
import {
  binarySearchProbeCount,
  warmSearchProbeCount,
  warmSearchRankMoveBudget,
} from "../src/search.ts";
import { canSkipFullTextFit } from "../src/text.ts";

import type { PreparedText, TextClampHint } from "../src/text.ts";

type SearchGateName = "fixed24" | "fixed32" | "fixed64" | "rankBudget";

type SearchGateStats = {
  accepted: number;
  cases: number;
  falseNegative: number;
  falsePositive: number;
  probes: number;
  regret: number;
};

type SearchProbeRow = {
  density: number;
  fixed32: number;
  oracle: number;
  rankBudget: number;
};

type FullFitGateName = "fixed24" | "fixed32" | "rankCapacity";

type FullFitGateStats = {
  cases: number;
  falseSkip: number;
  missedSkip: number;
  probeCost: number;
  trueSkip: number;
};

type FullFitProbeRow = {
  fixed24: number;
  fixed32: number;
  hiddenRank: number;
  oracle: number;
  rankCapacity: number;
};

type SearchGateReport = {
  byDensity: SearchProbeRow[];
  total: Record<SearchGateName, SearchGateStats>;
};

type FullFitGateReport = {
  byHiddenRank: FullFitProbeRow[];
  total: Record<FullFitGateName, FullFitGateStats>;
};

const searchCandidateCounts = [32, 64, 128, 256, 512, 1024, 2048, 4096] as const;
const searchWidthDeltas = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256] as const;
const rankDensities = [0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56] as const;
const hintRatios = [0.15, 0.35, 0.5, 0.65, 0.85] as const;
const directions = [-1, 1] as const;

const fullFitCandidateCounts = [64, 128, 256, 512, 1024, 2048] as const;
const fullFitRootWidths = [160, 240, 360, 520, 760] as const;
const fullFitWidthDeltas = [4, 8, 16, 24, 32, 48, 64, 96, 128] as const;
const hiddenRanks = [2, 4, 8, 16, 32, 64, 128, 256] as const;

function emptySearchStats(): SearchGateStats {
  return {
    accepted: 0,
    cases: 0,
    falseNegative: 0,
    falsePositive: 0,
    probes: 0,
    regret: 0,
  };
}

function emptyFullFitStats(): FullFitGateStats {
  return {
    cases: 0,
    falseSkip: 0,
    missedSkip: 0,
    probeCost: 0,
    trueSkip: 0,
  };
}

function emptySearchGateStats(): Record<SearchGateName, SearchGateStats> {
  return {
    fixed24: emptySearchStats(),
    fixed32: emptySearchStats(),
    fixed64: emptySearchStats(),
    rankBudget: emptySearchStats(),
  };
}

function emptyFullFitGateStats(): Record<FullFitGateName, FullFitGateStats> {
  return {
    fixed24: emptyFullFitStats(),
    fixed32: emptyFullFitStats(),
    rankCapacity: emptyFullFitStats(),
  };
}

function clampIndex(index: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index));
}

function searchTarget(
  hint: number,
  widthDelta: number,
  rankDensity: number,
  direction: -1 | 1,
  count: number,
): number {
  return clampIndex(hint + Math.round(widthDelta * rankDensity) * direction, count);
}

function recordSearchGate(
  stats: SearchGateStats,
  useWarm: boolean,
  warmIsBest: boolean,
  warmProbes: number,
  coldProbes: number,
): void {
  const probes = useWarm ? warmProbes : coldProbes;

  stats.cases += 1;
  stats.accepted += useWarm ? 1 : 0;
  stats.falsePositive += useWarm && !warmIsBest ? 1 : 0;
  stats.falseNegative += !useWarm && warmIsBest ? 1 : 0;
  stats.probes += probes;
  stats.regret += probes - Math.min(warmProbes, coldProbes);
}

function searchGateReport(expansionLimit: number): SearchGateReport {
  const total = emptySearchGateStats();
  const byDensity: SearchProbeRow[] = rankDensities.map((density) => ({
    density,
    fixed32: 0,
    oracle: 0,
    rankBudget: 0,
  }));

  for (const count of searchCandidateCounts) {
    for (const hintRatio of hintRatios) {
      const hint = Math.round((count - 1) * hintRatio);

      for (const direction of directions) {
        for (const [densityIndex, rankDensity] of rankDensities.entries()) {
          const row = byDensity[densityIndex]!;

          for (const widthDelta of searchWidthDeltas) {
            const target = searchTarget(hint, widthDelta, rankDensity, direction, count);
            const rankMove = Math.abs(target - hint);
            const warmProbes = warmSearchProbeCount(count, hint, target, expansionLimit);
            const coldProbes = binarySearchProbeCount(count);
            const warmIsBest = warmProbes <= coldProbes;
            const fixed32Warm = widthDelta <= 32;
            const rankBudgetWarm = rankMove <= warmSearchRankMoveBudget(count, expansionLimit);

            recordSearchGate(total.fixed24, widthDelta <= 24, warmIsBest, warmProbes, coldProbes);
            recordSearchGate(total.fixed32, fixed32Warm, warmIsBest, warmProbes, coldProbes);
            recordSearchGate(total.fixed64, widthDelta <= 64, warmIsBest, warmProbes, coldProbes);
            recordSearchGate(total.rankBudget, rankBudgetWarm, warmIsBest, warmProbes, coldProbes);

            row.fixed32 += fixed32Warm ? warmProbes : coldProbes;
            row.rankBudget += rankBudgetWarm ? warmProbes : coldProbes;
            row.oracle += Math.min(warmProbes, coldProbes);
          }
        }
      }
    }
  }

  return {
    byDensity,
    total,
  };
}

function preparedTextForCount(count: number): PreparedText {
  return {
    boundary: "grapheme",
    boundaryOffsets: Array.from({ length: count + 1 }, (_, index) => index),
    text: "x".repeat(count),
  };
}

function bestSearchProbeCount(
  count: number,
  hint: number,
  target: number,
  expansionLimit: number,
): number {
  return Math.min(
    warmSearchProbeCount(count, hint, target, expansionLimit),
    binarySearchProbeCount(count),
  );
}

function fullFitProbeCost(
  skipFullFit: boolean,
  candidateCount: number,
  kept: number,
  estimatedGain: number,
): number {
  const fullTarget = Math.min(candidateCount, kept + Math.ceil(estimatedGain));
  const actualFull = fullTarget >= candidateCount;

  if (skipFullFit) {
    return bestSearchProbeCount(candidateCount + 1, kept, fullTarget, 2);
  }

  const clampedTarget = Math.min(candidateCount - 1, fullTarget);

  return actualFull ? 1 : 1 + bestSearchProbeCount(candidateCount, kept, clampedTarget, 2);
}

function recordFullFitGate(
  stats: FullFitGateStats,
  skipFullFit: boolean,
  actualFull: boolean,
  probeCost: number,
): void {
  stats.cases += 1;
  stats.probeCost += probeCost;

  if (skipFullFit && actualFull) {
    stats.falseSkip += 1;
  } else if (skipFullFit) {
    stats.trueSkip += 1;
  } else if (!actualFull) {
    stats.missedSkip += 1;
  }
}

function fullFitGateReport(): FullFitGateReport {
  const total = emptyFullFitGateStats();
  const byHiddenRank: FullFitProbeRow[] = hiddenRanks.map((hiddenRank) => ({
    fixed24: 0,
    fixed32: 0,
    hiddenRank,
    oracle: 0,
    rankCapacity: 0,
  }));

  for (const candidateCount of fullFitCandidateCounts) {
    const prepared = preparedTextForCount(candidateCount);

    for (const rootWidth of fullFitRootWidths) {
      for (const [hiddenRankIndex, hiddenRank] of hiddenRanks.entries()) {
        if (hiddenRank >= candidateCount) {
          continue;
        }

        const row = byHiddenRank[hiddenRankIndex]!;
        const kept = candidateCount - hiddenRank;

        for (const rankPerPx of rankDensities) {
          const hint: TextClampHint = {
            boundaryOffsets: prepared.boundaryOffsets,
            kept,
            rankPerPx,
            rootWidth,
          };

          for (const widthDelta of fullFitWidthDeltas) {
            const estimatedGain = widthDelta * rankPerPx;
            const actualFull = kept + Math.ceil(estimatedGain) >= candidateCount;
            const fixed24Skip = widthDelta <= 24;
            const fixed32Skip = widthDelta <= 32;
            const rankCapacitySkip = canSkipFullTextFit(prepared, hint, rootWidth + widthDelta, 3);
            const fixed24Cost = fullFitProbeCost(fixed24Skip, candidateCount, kept, estimatedGain);
            const fixed32Cost = fullFitProbeCost(fixed32Skip, candidateCount, kept, estimatedGain);
            const rankCapacityCost = fullFitProbeCost(
              rankCapacitySkip,
              candidateCount,
              kept,
              estimatedGain,
            );
            const skipCost = fullFitProbeCost(true, candidateCount, kept, estimatedGain);
            const fitFirstCost = fullFitProbeCost(false, candidateCount, kept, estimatedGain);

            recordFullFitGate(total.fixed24, fixed24Skip, actualFull, fixed24Cost);
            recordFullFitGate(total.fixed32, fixed32Skip, actualFull, fixed32Cost);
            recordFullFitGate(total.rankCapacity, rankCapacitySkip, actualFull, rankCapacityCost);

            row.fixed24 += fixed24Cost;
            row.fixed32 += fixed32Cost;
            row.rankCapacity += rankCapacityCost;
            row.oracle += Math.min(skipCost, fitFirstCost);
          }
        }
      }
    }
  }

  return {
    byHiddenRank,
    total,
  };
}

describe("warm threshold matrix", () => {
  it("keeps rank-space search hints closer to the exact warm/cold probe oracle", () => {
    const text = searchGateReport(2);
    const rich = searchGateReport(3);

    expect(text.total.fixed32.probes).toBe(62224);
    expect(text.total.rankBudget.probes).toBe(60417);
    expect(text.total.fixed32.regret).toBe(4756);
    expect(text.total.rankBudget.regret).toBe(2949);
    expect(text.total.rankBudget.probes).toBeLessThan(text.total.fixed32.probes * 0.972);
    expect(text.total.rankBudget.regret).toBeLessThan(text.total.fixed32.regret * 0.63);
    expect(text.byDensity).toEqual([
      { density: 0.02, fixed32: 5600, oracle: 3870, rankBudget: 4046 },
      { density: 0.04, fixed32: 5760, oracle: 5047, rankBudget: 5375 },
      { density: 0.08, fixed32: 6306, oracle: 6229, rankBudget: 6687 },
      { density: 0.16, fixed32: 7566, oracle: 7321, rankBudget: 7801 },
      { density: 0.32, fixed32: 8655, oracle: 8258, rankBudget: 8755 },
      { density: 0.64, fixed32: 9247, oracle: 8766, rankBudget: 9199 },
      { density: 1.28, fixed32: 9543, oracle: 8989, rankBudget: 9347 },
      { density: 2.56, fixed32: 9547, oracle: 8988, rankBudget: 9207 },
    ]);

    expect(rich.total.fixed32.probes).toBe(60555);
    expect(rich.total.rankBudget.probes).toBe(57114);
    expect(rich.total.fixed32.regret).toBe(6824);
    expect(rich.total.rankBudget.regret).toBe(3383);
    expect(rich.total.rankBudget.probes).toBeLessThan(rich.total.fixed32.probes * 0.944);
    expect(rich.total.rankBudget.regret).toBeLessThan(rich.total.fixed32.regret * 0.5);
    expect(rich.byDensity).toEqual([
      { density: 0.02, fixed32: 5600, oracle: 3194, rankBudget: 3194 },
      { density: 0.04, fixed32: 5760, oracle: 4383, rankBudget: 4650 },
      { density: 0.08, fixed32: 6159, oracle: 5573, rankBudget: 6114 },
      { density: 0.16, fixed32: 6714, oracle: 6683, rankBudget: 7268 },
      { density: 0.32, fixed32: 7930, oracle: 7633, rankBudget: 8226 },
      { density: 0.64, fixed32: 9005, oracle: 8425, rankBudget: 9026 },
      { density: 1.28, fixed32: 9489, oracle: 8781, rankBudget: 9248 },
      { density: 2.56, fixed32: 9898, oracle: 9059, rankBudget: 9388 },
    ]);
  });

  it("guards full-fit skips with hidden-rank capacity instead of pixel width alone", () => {
    const stats = fullFitGateReport();

    expect(stats.total.fixed24.falseSkip).toBe(1590);
    expect(stats.total.fixed32.falseSkip).toBe(2245);
    expect(stats.total.rankCapacity.falseSkip).toBe(0);
    expect(stats.total.fixed24.probeCost).toBe(73710);
    expect(stats.total.fixed32.probeCost).toBe(75360);
    expect(stats.total.rankCapacity.probeCost).toBe(67564);
    expect(stats.total.rankCapacity.probeCost).toBeLessThan(stats.total.fixed32.probeCost * 0.897);
    expect(stats.total.rankCapacity.trueSkip).toBeGreaterThan(stats.total.fixed24.trueSkip);
    expect(stats.byHiddenRank).toEqual([
      { fixed24: 4200, fixed32: 4620, hiddenRank: 2, oracle: 2940, rankCapacity: 2940 },
      { fixed24: 6030, fixed32: 6420, hiddenRank: 4, oracle: 4590, rankCapacity: 4734 },
      { fixed24: 7890, fixed32: 8340, hiddenRank: 8, oracle: 5940, rankCapacity: 6285 },
      { fixed24: 9750, fixed32: 10170, hiddenRank: 16, oracle: 8190, rankCapacity: 8580 },
      { fixed24: 12265, fixed32: 12495, hiddenRank: 32, oracle: 11075, rankCapacity: 11711 },
      { fixed24: 12220, fixed32: 12240, hiddenRank: 64, oracle: 11445, rankCapacity: 12108 },
      { fixed24: 11555, fixed32: 11395, hiddenRank: 128, oracle: 10835, rankCapacity: 11462 },
      { fixed24: 9800, fixed32: 9680, hiddenRank: 256, oracle: 9215, rankCapacity: 9744 },
    ]);
  });
});
