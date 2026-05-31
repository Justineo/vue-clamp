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
  regret: number;
};

type FullFitGateName = "fixed24" | "fixed32" | "rankCapacity";

type FullFitGateStats = {
  cases: number;
  falseSkip: number;
  missedSkip: number;
  trueSkip: number;
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
    regret: 0,
  };
}

function emptyFullFitStats(): FullFitGateStats {
  return {
    cases: 0,
    falseSkip: 0,
    missedSkip: 0,
    trueSkip: 0,
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
  stats.regret += probes - Math.min(warmProbes, coldProbes);
}

function searchGateStats(expansionLimit: number): Record<SearchGateName, SearchGateStats> {
  const stats: Record<SearchGateName, SearchGateStats> = {
    fixed24: emptySearchStats(),
    fixed32: emptySearchStats(),
    fixed64: emptySearchStats(),
    rankBudget: emptySearchStats(),
  };

  for (const count of searchCandidateCounts) {
    for (const hintRatio of hintRatios) {
      const hint = Math.round((count - 1) * hintRatio);

      for (const direction of directions) {
        for (const rankDensity of rankDensities) {
          for (const widthDelta of searchWidthDeltas) {
            const target = searchTarget(hint, widthDelta, rankDensity, direction, count);
            const rankMove = Math.abs(target - hint);
            const warmProbes = warmSearchProbeCount(count, hint, target, expansionLimit);
            const coldProbes = binarySearchProbeCount(count);
            const warmIsBest = warmProbes <= coldProbes;

            recordSearchGate(stats.fixed24, widthDelta <= 24, warmIsBest, warmProbes, coldProbes);
            recordSearchGate(stats.fixed32, widthDelta <= 32, warmIsBest, warmProbes, coldProbes);
            recordSearchGate(stats.fixed64, widthDelta <= 64, warmIsBest, warmProbes, coldProbes);
            recordSearchGate(
              stats.rankBudget,
              rankMove <= warmSearchRankMoveBudget(count, expansionLimit),
              warmIsBest,
              warmProbes,
              coldProbes,
            );
          }
        }
      }
    }
  }

  return stats;
}

function preparedTextForCount(count: number): PreparedText {
  return {
    boundary: "grapheme",
    boundaryOffsets: Array.from({ length: count + 1 }, (_, index) => index),
    text: "x".repeat(count),
  };
}

function recordFullFitGate(
  stats: FullFitGateStats,
  skipFullFit: boolean,
  actualFull: boolean,
): void {
  stats.cases += 1;

  if (skipFullFit && actualFull) {
    stats.falseSkip += 1;
  } else if (skipFullFit) {
    stats.trueSkip += 1;
  } else if (!actualFull) {
    stats.missedSkip += 1;
  }
}

function fullFitGateStats(): Record<FullFitGateName, FullFitGateStats> {
  const stats: Record<FullFitGateName, FullFitGateStats> = {
    fixed24: emptyFullFitStats(),
    fixed32: emptyFullFitStats(),
    rankCapacity: emptyFullFitStats(),
  };

  for (const candidateCount of fullFitCandidateCounts) {
    const prepared = preparedTextForCount(candidateCount);

    for (const rootWidth of fullFitRootWidths) {
      for (const hiddenRank of hiddenRanks) {
        if (hiddenRank >= candidateCount) {
          continue;
        }

        const kept = candidateCount - hiddenRank;

        for (const rankPerPx of rankDensities) {
          const hint: TextClampHint = {
            boundaryOffsets: prepared.boundaryOffsets,
            kept,
            rankPerPx,
            rootWidth,
          };

          for (const widthDelta of fullFitWidthDeltas) {
            const actualFull = kept + Math.ceil(widthDelta * rankPerPx) >= candidateCount;

            recordFullFitGate(stats.fixed24, widthDelta <= 24, actualFull);
            recordFullFitGate(stats.fixed32, widthDelta <= 32, actualFull);
            recordFullFitGate(
              stats.rankCapacity,
              canSkipFullTextFit(prepared, hint, rootWidth + widthDelta, 3),
              actualFull,
            );
          }
        }
      }
    }
  }

  return stats;
}

describe("warm threshold matrix", () => {
  it("keeps rank-space search hints closer to the exact warm/cold probe oracle", () => {
    const text = searchGateStats(2);
    const rich = searchGateStats(3);

    expect(text.fixed32.regret).toBe(4756);
    expect(text.rankBudget.regret).toBe(2949);
    expect(text.rankBudget.regret).toBeLessThan(text.fixed32.regret * 0.63);

    expect(rich.fixed32.regret).toBe(6824);
    expect(rich.rankBudget.regret).toBe(3383);
    expect(rich.rankBudget.regret).toBeLessThan(rich.fixed32.regret * 0.5);
  });

  it("guards full-fit skips with hidden-rank capacity instead of pixel width alone", () => {
    const stats = fullFitGateStats();

    expect(stats.fixed24.falseSkip).toBe(1590);
    expect(stats.fixed32.falseSkip).toBe(2245);
    expect(stats.rankCapacity.falseSkip).toBe(0);
    expect(stats.rankCapacity.trueSkip).toBeGreaterThan(stats.fixed24.trueSkip);
  });
});
