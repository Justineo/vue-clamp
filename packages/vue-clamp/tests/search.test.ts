import { describe, expect, it } from "vite-plus/test";
import {
  defaultWarmExpansionLimit,
  estimateColdSearchMaxProbeCount,
  findLargestFittingCount,
  findLastFittingIndex,
  richWarmExpansionLimit,
  warmSearchLocalCoverage,
} from "../src/search.ts";
import {
  estimateColdSearchProbeCount,
  estimateTargetRankInterval,
  estimateTargetRankLocalInterval,
  estimateWarmColdProbeCost,
  estimateWarmSearchProbeCount,
  estimateWarmSearchRankRoom,
  estimateWarmSearchWidthRoom,
  requiredWholeWarmCredit,
  warmSearchAdvanceWindow,
  warmSearchCanBeatCold,
  warmSearchCanBeatColdByCost,
  warmSearchDecision,
} from "./search-model.ts";

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

  function fixedWidthWindowAllows(
    previousWidth: number,
    nextWidth: number,
    widthWindow: number,
  ): boolean {
    return Math.abs(nextWidth - previousWidth) <= widthWindow;
  }

  function estimatedTargetFromSlope(
    count: number,
    hint: number,
    previousWidth: number,
    nextWidth: number,
    rankPerPx: number,
  ): number {
    const maxIndex = count - 1;
    const rankMove = Math.ceil(Math.abs(nextWidth - previousWidth) * rankPerPx);
    const target = hint + Math.sign(nextWidth - previousWidth) * rankMove;

    return Math.max(0, Math.min(maxIndex, target));
  }

  function warmProbeModelWins(count: number, hint: number, target: number): boolean {
    return (
      estimateWarmSearchProbeCount(count, hint, target) < estimateColdSearchMaxProbeCount(count)
    );
  }

  function warmWinsAcrossInterval(
    count: number,
    hint: number,
    minTarget: number,
    maxTarget: number,
    warmPatchCredit = 0,
    expansionLimit = defaultWarmExpansionLimit,
  ): boolean {
    return warmSearchCanBeatCold({
      count,
      expansionLimit,
      hint,
      interval: { max: maxTarget, min: minTarget },
      warmCredit: warmPatchCredit,
    });
  }

  function warmWinsWithPatchDominance(
    count: number,
    hint: number,
    minTarget: number,
    maxTarget: number,
    hasPatchDominance: boolean,
    expansionLimit = defaultWarmExpansionLimit,
  ): boolean {
    return warmSearchCanBeatCold({
      allowPatchTieBreak: hasPatchDominance,
      count,
      expansionLimit,
      hint,
      interval: { max: maxTarget, min: minTarget },
    });
  }

  function warmWinsWhenSkippingFullPrecheck(
    count: number,
    hint: number,
    minTarget: number,
    maxTarget: number,
    hasPatchDominance: boolean,
    expansionLimit = defaultWarmExpansionLimit,
  ): boolean {
    const { warmMax } = estimateWarmColdProbeCost({
      count,
      expansionLimit,
      hint,
      interval: { max: maxTarget, min: minTarget },
    });
    const coldCost = 1 + estimateColdSearchMaxProbeCount(count - 1);

    return warmSearchCanBeatColdByCost(warmMax, coldCost, hasPatchDominance);
  }

  type LayoutCostVector = {
    readonly bbox: number;
    readonly maxHeightBounds: number;
    readonly rectList: number;
  };

  type StrategyCost = {
    readonly layout: LayoutCostVector;
    readonly patchDominates?: boolean;
    readonly scalarPatchCredit?: number;
  };

  function layoutProbeCost({ bbox, maxHeightBounds, rectList }: LayoutCostVector): number {
    return bbox + maxHeightBounds + rectList;
  }

  function layoutVectorDominates(warm: LayoutCostVector, cold: LayoutCostVector): boolean {
    return (
      warm.bbox <= cold.bbox &&
      warm.maxHeightBounds <= cold.maxHeightBounds &&
      warm.rectList <= cold.rectList
    );
  }

  function chooseWarmByModel(warm: StrategyCost, cold: StrategyCost): boolean {
    return warmSearchCanBeatColdByCost(
      layoutProbeCost(warm.layout),
      layoutProbeCost(cold.layout),
      !!warm.patchDominates && layoutVectorDominates(warm.layout, cold.layout),
      warm.scalarPatchCredit,
    );
  }

  function finiteHint(count: number, hint: number): number {
    return Math.max(0, Math.min(count - 1, Math.floor(hint)));
  }

  function rankRoomMoveCount(count: number, hint: number, direction: -1 | 1): number {
    const start = finiteHint(count, hint);

    return direction > 0 ? count - start : start + 2;
  }

  function intervalForMove(start: number, move: number, direction: -1 | 1) {
    const target = start + direction * move;

    return {
      max: Math.max(start, target),
      min: Math.min(start, target),
    };
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

  it("shows fixed pixel windows are not an optimality proof", () => {
    const count = 64;
    const hint = 16;
    const previousWidth = 200;
    const widthWindow = 32;
    const coldProbes = estimateColdSearchMaxProbeCount(count);
    const acceptedWidth = previousWidth + widthWindow;
    const rejectedWidth = acceptedWidth + 1;

    const lowDensityAccepted = estimatedTargetFromSlope(
      count,
      hint,
      previousWidth,
      acceptedWidth,
      1 / widthWindow,
    );
    const highDensityAccepted = estimatedTargetFromSlope(
      count,
      hint,
      previousWidth,
      acceptedWidth,
      1,
    );
    const lowDensityRejected = estimatedTargetFromSlope(
      count,
      hint,
      previousWidth,
      rejectedWidth,
      1 / (widthWindow + 1),
    );

    expect(fixedWidthWindowAllows(previousWidth, acceptedWidth, widthWindow)).toBe(true);
    expect(estimateWarmSearchProbeCount(count, hint, lowDensityAccepted)).toBeLessThan(coldProbes);
    expect(estimateWarmSearchProbeCount(count, hint, highDensityAccepted)).toBeGreaterThan(
      coldProbes,
    );

    expect(fixedWidthWindowAllows(previousWidth, rejectedWidth, widthWindow)).toBe(false);
    expect(warmProbeModelWins(count, hint, lowDensityRejected)).toBe(true);
  });

  it("compares warm and cold over the full target-rank interval", () => {
    const count = 64;
    const hint = 16;

    expect(warmWinsAcrossInterval(count, hint, 16, 18)).toBe(true);
    expect(warmWinsAcrossInterval(count, hint, 16, 19)).toBe(false);

    const local = estimateWarmColdProbeCost({
      count,
      hint,
      interval: { max: 18, min: 16 },
    });
    const ambiguous = estimateWarmColdProbeCost({
      count,
      hint,
      interval: { max: 19, min: 16 },
    });
    expect(local.warmMax).toBeLessThan(local.coldMin);
    expect(ambiguous.warmMax).toBeGreaterThanOrEqual(ambiguous.coldMin);
  });

  it("normalizes target intervals and extra cold cost in the shared cost model", () => {
    expect(
      estimateWarmColdProbeCost({
        coldExtraCost: 2,
        count: 64,
        hint: 16,
        interval: { max: 16, min: 18 },
      }),
    ).toEqual({
      coldMin: 8,
      warmMax: 4,
    });

    expect(
      estimateWarmColdProbeCost({
        coldExtraCost: Number.NaN,
        count: 0,
        hint: 16,
        interval: { max: 18, min: 16 },
      }),
    ).toEqual({
      coldMin: 0,
      warmMax: 0,
    });
  });

  it("bounds target rank from width, visible capacity, and candidate advance", () => {
    expect(
      estimateTargetRankInterval({
        advance: { max: 18, min: 6 },
        lineCapacity: 3,
        nextWidth: 240,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 63, min: 16 });

    expect(
      estimateTargetRankInterval({
        advance: { max: 18, min: 6 },
        lineCapacity: 3,
        nextWidth: 240,
        packingSlack: 54,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 45, min: 16 });

    expect(
      estimateTargetRankInterval({
        advance: { max: 18, min: 6 },
        lineCapacity: 3,
        nextWidth: 190,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 16, min: 11 });

    expect(
      estimateTargetRankInterval({
        advance: { max: 18, min: 6 },
        lineCapacity: 3,
        nextWidth: 190,
        packingSlack: 24,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 16, min: 11 });

    expect(
      estimateTargetRankInterval({
        advance: { max: 18, min: 6 },
        lineCapacity: 3,
        nextWidth: 190,
        packingSlack: 24,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
        shrinkLineBreaksKnown: true,
      }),
    ).toEqual({ max: 16, min: 15 });
  });

  it("tightens target-rank uncertainty from local candidate advances", () => {
    const advances = Array.from({ length: 63 }, () => 12);

    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances,
        lineCapacity: 3,
        nextWidth: 240,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 63, min: 16 });

    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances,
        lineCapacity: 3,
        nextWidth: 160,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 16, min: 6 });

    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances,
        lineCapacity: 3,
        nextWidth: 240,
        packingSlack: 0,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 26, min: 16 });

    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances,
        lineCapacity: 3,
        nextWidth: 240,
        packingSlack: 36,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 29, min: 16 });

    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances,
        lineCapacity: 3,
        nextWidth: 160,
        packingSlack: 24,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 16, min: 6 });

    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances,
        lineCapacity: 3,
        nextWidth: 160,
        packingSlack: 24,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
        shrinkLineBreaksKnown: true,
      }),
    ).toEqual({ max: 16, min: 8 });
  });

  it("falls back to global target-rank bounds when local advances are missing", () => {
    expect(
      estimateTargetRankLocalInterval({
        advance: { max: 18, min: 6 },
        advances: [],
        lineCapacity: 3,
        nextWidth: 240,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 63, min: 16 });
  });

  it("derives warm width room from layout physics instead of a fixed pixel window", () => {
    function room(advance: number, lineCapacity: number, packingSlack?: number) {
      return estimateWarmSearchWidthRoom({
        advances: Array.from({ length: 63 }, () => advance),
        count: 64,
        hint: 16,
        lineCapacity,
        ...(packingSlack === undefined ? {} : { packingSlack }),
      });
    }

    expect(estimateWarmSearchRankRoom({ count: 64, hint: 16 })).toEqual({
      maxRankMove: 2,
      useWarm: true,
    });
    expect(estimateWarmSearchRankRoom({ count: 64, direction: -1, hint: 16 })).toEqual({
      maxRankMove: 3,
      useWarm: true,
    });
    expect(room(8, 1, 0)).toEqual({
      maxRankMove: 2,
      useWarm: true,
      widthDeltaLimit: 24,
    });
    expect(room(24, 1, 0)).toEqual({
      maxRankMove: 2,
      useWarm: true,
      widthDeltaLimit: 72,
    });
    expect(room(16, 1, 0)).toEqual({
      maxRankMove: 2,
      useWarm: true,
      widthDeltaLimit: 48,
    });
    expect(room(16, 3, 0)).toEqual({
      maxRankMove: 2,
      useWarm: true,
      widthDeltaLimit: 16,
    });
    expect(room(16, 1)).toEqual({
      maxRankMove: 2,
      useWarm: true,
      widthDeltaLimit: 32,
    });
    expect(
      estimateWarmSearchWidthRoom({
        advances: Array.from({ length: 63 }, () => 16),
        count: 64,
        direction: -1,
        hint: 16,
        lineCapacity: 1,
        packingSlack: 0,
      }),
    ).toEqual({ maxRankMove: 3, useWarm: true, widthDeltaLimit: 48 });
    expect(
      estimateWarmSearchWidthRoom({
        advances: [],
        count: 1,
        hint: 0,
        lineCapacity: 1,
      }),
    ).toEqual({ maxRankMove: 0, useWarm: false, widthDeltaLimit: 0 });
  });

  it("requires line-capacity evidence before widening the dynamic warm window", () => {
    const advances = Array.from({ length: 63 }, () => 16);
    const advance = { max: 16, min: 16 };
    const count = advances.length + 1;
    const previousRank = 16;
    const previousWidth = 200;
    const nextWidth = 236;
    const oneLineInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });
    const twoLineInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 2,
      nextWidth,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });
    const oneLineRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      hint: previousRank,
      lineCapacity: 1,
      packingSlack: 0,
    });
    const twoLineRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      hint: previousRank,
      lineCapacity: 2,
      packingSlack: 0,
    });

    expect(oneLineRoom.widthDeltaLimit).toBeGreaterThan(nextWidth - previousWidth);
    expect(twoLineRoom.widthDeltaLimit).toBeLessThan(nextWidth - previousWidth);
    expect(oneLineInterval).toEqual({ max: 18, min: previousRank });
    expect(twoLineInterval.max).toBeGreaterThan(oneLineInterval.max);
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: oneLineInterval,
      }).useWarm,
    ).toBe(true);
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: twoLineInterval,
      }).useWarm,
    ).toBe(false);
  });

  it("uses total packing slack in opposite directions only with shrink line-break proof", () => {
    const advances = Array.from({ length: 63 }, () => 16);
    const count = advances.length + 1;
    const previousRank = 16;
    const lineCapacity = 2;
    const packingSlack = 20;
    const growRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      hint: previousRank,
      lineCapacity,
      packingSlack,
    });
    const shrinkRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      direction: -1,
      hint: previousRank,
      lineCapacity,
      packingSlack,
    });
    const provedShrinkRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      direction: -1,
      hint: previousRank,
      lineCapacity,
      packingSlack,
      shrinkLineBreaksKnown: true,
    });

    expect(growRoom).toEqual({
      maxRankMove: 2,
      useWarm: true,
      widthDeltaLimit: 14,
    });
    expect(shrinkRoom).toEqual({
      maxRankMove: 3,
      useWarm: true,
      widthDeltaLimit: 24,
    });
    expect(provedShrinkRoom).toEqual({
      maxRankMove: 3,
      useWarm: true,
      widthDeltaLimit: 34,
    });
  });

  it("needs only the next rejected local advances when packing slack is known", () => {
    const fullAdvances = Array.from({ length: 63 }, () => 16);
    const sparseGrow = Array.from<number>({ length: 63 });
    sparseGrow[16] = 16;
    sparseGrow[17] = 16;
    sparseGrow[18] = 16;
    const sparseShrink = Array.from<number>({ length: 63 });
    sparseShrink[15] = 16;
    sparseShrink[14] = 16;
    sparseShrink[13] = 16;

    expect(warmSearchAdvanceWindow({ count: 64, hint: 16 })).toEqual({
      indexes: [16, 17, 18],
      maxRankMove: 2,
      unbounded: false,
      useWarm: true,
    });
    expect(warmSearchAdvanceWindow({ count: 64, direction: -1, hint: 16 })).toEqual({
      indexes: [15, 14, 13],
      maxRankMove: 3,
      unbounded: false,
      useWarm: true,
    });
    expect(
      estimateWarmSearchWidthRoom({
        advances: sparseGrow,
        count: 64,
        hint: 16,
        lineCapacity: 1,
        packingSlack: 0,
      }),
    ).toEqual(
      estimateWarmSearchWidthRoom({
        advances: fullAdvances,
        count: 64,
        hint: 16,
        lineCapacity: 1,
        packingSlack: 0,
      }),
    );
    expect(
      estimateWarmSearchWidthRoom({
        advances: sparseShrink,
        count: 64,
        direction: -1,
        hint: 16,
        lineCapacity: 1,
        packingSlack: 0,
      }),
    ).toEqual(
      estimateWarmSearchWidthRoom({
        advances: fullAdvances,
        count: 64,
        direction: -1,
        hint: 16,
        lineCapacity: 1,
        packingSlack: 0,
      }),
    );
    const fullAdvancesWithUnseenWide = [...fullAdvances];
    fullAdvancesWithUnseenWide[50] = 48;
    expect(
      estimateWarmSearchWidthRoom({
        advances: sparseGrow,
        count: 64,
        hint: 16,
        lineCapacity: 1,
      }).widthDeltaLimit,
    ).toBeGreaterThan(
      estimateWarmSearchWidthRoom({
        advances: fullAdvancesWithUnseenWide,
        count: 64,
        hint: 16,
        lineCapacity: 1,
      }).widthDeltaLimit,
    );
  });

  it("keeps warm rank room equivalent to interval decisions across input space", () => {
    for (const count of [1, 2, 3, 4, 5, 8, 16, 17, 31, 64]) {
      for (const hint of [-2, 0, 1, Math.floor(count / 2), count - 1, count + 2]) {
        for (const direction of [-1, 1] as const) {
          for (const expansionLimit of [0, 1, 2, 3]) {
            for (const allowPatchTieBreak of [false, true]) {
              for (const warmCredit of [0, 1]) {
                const start = finiteHint(count, hint);
                const room = estimateWarmSearchRankRoom({
                  allowPatchTieBreak,
                  count,
                  direction,
                  expansionLimit,
                  hint,
                  warmCredit,
                });

                for (let move = 0; move < rankRoomMoveCount(count, hint, direction); move += 1) {
                  const decision = warmSearchDecision({
                    allowPatchTieBreak,
                    count,
                    expansionLimit,
                    hint: start,
                    interval: intervalForMove(start, move, direction),
                    warmCredit,
                  });

                  expect(decision.useWarm).toBe(room.useWarm && move <= room.maxRankMove);
                }
              }
            }
          }
        }
      }
    }
  });

  it("places warm width room on the local interval decision boundary", () => {
    const advances = Array.from({ length: 63 }, () => 16);
    const previousRank = 16;
    const previousWidth = 200;
    const count = 64;
    const growRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      hint: previousRank,
      lineCapacity: 1,
      packingSlack: 0,
    });
    const shrinkRoom = estimateWarmSearchWidthRoom({
      advances,
      count,
      direction: -1,
      hint: previousRank,
      lineCapacity: 1,
      packingSlack: 0,
    });

    const growInside = estimateTargetRankLocalInterval({
      advance: { max: 16, min: 16 },
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth + growRoom.widthDeltaLimit - 0.001,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });
    const growBoundary = estimateTargetRankLocalInterval({
      advance: { max: 16, min: 16 },
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth + growRoom.widthDeltaLimit,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });
    const shrinkInside = estimateTargetRankLocalInterval({
      advance: { max: 16, min: 16 },
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth - shrinkRoom.widthDeltaLimit + 0.001,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });
    const shrinkBoundary = estimateTargetRankLocalInterval({
      advance: { max: 16, min: 16 },
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth - shrinkRoom.widthDeltaLimit,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });
    const shrinkOutside = estimateTargetRankLocalInterval({
      advance: { max: 16, min: 16 },
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth - shrinkRoom.widthDeltaLimit - 0.001,
      packingSlack: 0,
      previousRank,
      previousWidth,
      rankCount: count,
    });

    expect(growInside).toEqual({ max: previousRank + growRoom.maxRankMove, min: previousRank });
    expect(growBoundary).toEqual({
      max: previousRank + growRoom.maxRankMove + 1,
      min: previousRank,
    });
    expect(shrinkInside).toEqual({ max: previousRank, min: previousRank - shrinkRoom.maxRankMove });
    expect(shrinkBoundary).toEqual({
      max: previousRank,
      min: previousRank - shrinkRoom.maxRankMove,
    });
    expect(shrinkOutside).toEqual({
      max: previousRank,
      min: previousRank - shrinkRoom.maxRankMove - 1,
    });
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: growInside,
      }).useWarm,
    ).toBe(true);
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: growBoundary,
      }).useWarm,
    ).toBe(false);
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: shrinkInside,
      }).useWarm,
    ).toBe(true);
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: shrinkBoundary,
      }).useWarm,
    ).toBe(true);
    expect(
      warmSearchDecision({
        count,
        hint: previousRank,
        interval: shrinkOutside,
      }).useWarm,
    ).toBe(false);
  });

  it("keeps warm width room aligned with interval decisions across physical inputs", () => {
    const advanceSets = [
      Array.from({ length: 63 }, () => 8),
      Array.from({ length: 63 }, (_, index) => (index % 3 === 0 ? 6 : index % 3 === 1 ? 12 : 20)),
      Array.from({ length: 63 }, (_, index) => 10 + (index % 5) * 3),
    ];
    const epsilon = 0.0001;

    for (const advances of advanceSets) {
      const advance = {
        max: Math.max(...advances),
        min: Math.min(...advances),
      };
      const count = advances.length + 1;
      const previousRank = Math.floor(count / 3);
      const previousWidth = 240;

      for (const direction of [-1, 1] as const) {
        for (const lineCapacity of [1, 2, 4]) {
          for (const packingSlack of [undefined, 0, 9]) {
            for (const expansionLimit of [1, defaultWarmExpansionLimit, richWarmExpansionLimit]) {
              for (const allowPatchTieBreak of [false, true]) {
                const room = estimateWarmSearchWidthRoom({
                  advances,
                  allowPatchTieBreak,
                  count,
                  direction,
                  expansionLimit,
                  hint: previousRank,
                  lineCapacity,
                  ...(packingSlack === undefined ? {} : { packingSlack }),
                });

                if (
                  !room.useWarm ||
                  !Number.isFinite(room.widthDeltaLimit) ||
                  room.widthDeltaLimit <= epsilon
                ) {
                  continue;
                }

                const insideWidth = previousWidth + direction * (room.widthDeltaLimit - epsilon);
                const outsideWidth = previousWidth + direction * (room.widthDeltaLimit + epsilon);
                const insideInterval = estimateTargetRankLocalInterval({
                  advance,
                  advances,
                  lineCapacity,
                  nextWidth: insideWidth,
                  ...(packingSlack === undefined ? {} : { packingSlack }),
                  previousRank,
                  previousWidth,
                  rankCount: count,
                });
                const outsideInterval = estimateTargetRankLocalInterval({
                  advance,
                  advances,
                  lineCapacity,
                  nextWidth: outsideWidth,
                  ...(packingSlack === undefined ? {} : { packingSlack }),
                  previousRank,
                  previousWidth,
                  rankCount: count,
                });

                expect(
                  warmSearchDecision({
                    allowPatchTieBreak,
                    count,
                    expansionLimit,
                    hint: previousRank,
                    interval: insideInterval,
                  }).useWarm,
                ).toBe(true);
                expect(
                  warmSearchDecision({
                    allowPatchTieBreak,
                    count,
                    expansionLimit,
                    hint: previousRank,
                    interval: outsideInterval,
                  }).useWarm,
                ).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it("widens target-rank uncertainty when physical inputs are missing", () => {
    expect(
      estimateTargetRankInterval({
        advance: { max: 0, min: Number.POSITIVE_INFINITY },
        lineCapacity: 3,
        nextWidth: 240,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 63, min: -1 });

    expect(
      estimateTargetRankInterval({
        advance: { max: 18, min: 6 },
        lineCapacity: 0,
        nextWidth: 240,
        previousRank: 16,
        previousWidth: 200,
        rankCount: 64,
      }),
    ).toEqual({ max: 63, min: -1 });
  });

  it("requires measured patch credit before accepting ambiguous intervals", () => {
    const count = 64;
    const hint = 16;
    const interval = estimateWarmColdProbeCost({
      count,
      hint,
      interval: { max: 19, min: 16 },
    });

    expect(interval).toEqual({ coldMin: 6, warmMax: 8 });
    expect(warmWinsAcrossInterval(count, hint, 16, 19)).toBe(false);
    expect(warmWinsAcrossInterval(count, hint, 16, 19, 2)).toBe(false);
    expect(warmWinsAcrossInterval(count, hint, 16, 19, 3)).toBe(true);
  });

  it("quantifies the whole-probe credit required before accepting warm search", () => {
    const count = 64;
    const hint = 16;

    expect(
      requiredWholeWarmCredit({
        count,
        hint,
        interval: { max: 18, min: 16 },
      }),
    ).toBe(0);
    expect(
      requiredWholeWarmCredit({
        count,
        hint,
        interval: { max: 19, min: 16 },
      }),
    ).toBe(3);
    expect(
      requiredWholeWarmCredit({
        count,
        expansionLimit: richWarmExpansionLimit,
        hint,
        interval: { max: 19, min: 16 },
      }),
    ).toBe(1);
    expect(
      requiredWholeWarmCredit({
        allowPatchTieBreak: true,
        count,
        expansionLimit: richWarmExpansionLimit,
        hint,
        interval: { max: 19, min: 16 },
      }),
    ).toBe(0);
  });

  it("describes an auditable warm-search decision", () => {
    const decision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: 64,
      expansionLimit: richWarmExpansionLimit,
      hint: 16,
      interval: { max: 19, min: 16 },
    });

    expect(decision).toEqual({
      coldMin: 6,
      requiredCredit: 0,
      useWarm: true,
      warmMax: 6,
    });

    expect(
      warmSearchDecision({
        count: 64,
        hint: 16,
        interval: { max: 19, min: 16 },
        warmCredit: 2,
      }),
    ).toEqual({
      coldMin: 6,
      requiredCredit: 3,
      useWarm: false,
      warmMax: 8,
    });
  });

  it("uses patch-vector dominance only as a probe-count tie breaker", () => {
    const count = 64;
    const hint = 16;
    const defaultAmbiguous = estimateWarmColdProbeCost({
      count,
      hint,
      interval: { max: 19, min: 16 },
    });
    const richTie = estimateWarmColdProbeCost({
      count,
      expansionLimit: richWarmExpansionLimit,
      hint,
      interval: { max: 19, min: 16 },
    });

    expect(defaultAmbiguous).toEqual({ coldMin: 6, warmMax: 8 });
    expect(warmWinsWithPatchDominance(count, hint, 16, 19, true)).toBe(false);

    expect(richTie).toEqual({ coldMin: 6, warmMax: 6 });
    expect(warmWinsWithPatchDominance(count, hint, 16, 19, false, richWarmExpansionLimit)).toBe(
      false,
    );
    expect(warmWinsWithPatchDominance(count, hint, 16, 19, true, richWarmExpansionLimit)).toBe(
      true,
    );
  });

  it("counts a skipped full-fit precheck separately from patch credit", () => {
    expect(warmWinsWhenSkippingFullPrecheck(16, 6, 6, 9, false)).toBe(false);
    expect(warmWinsWhenSkippingFullPrecheck(16, 6, 6, 9, true)).toBe(true);

    expect(warmWinsWhenSkippingFullPrecheck(64, 16, 16, 19, true)).toBe(false);
  });

  it("applies the model decision rule before benchmark validation", () => {
    const cold: StrategyCost = {
      layout: { bbox: 4, maxHeightBounds: 0, rectList: 2 },
    };

    expect(
      chooseWarmByModel(
        {
          layout: { bbox: 3, maxHeightBounds: 0, rectList: 2 },
        },
        cold,
      ),
    ).toBe(true);
    expect(
      chooseWarmByModel(
        {
          layout: { bbox: 4, maxHeightBounds: 0, rectList: 2 },
          patchDominates: true,
        },
        cold,
      ),
    ).toBe(true);
    expect(
      chooseWarmByModel(
        {
          layout: { bbox: 4, maxHeightBounds: 0, rectList: 2 },
        },
        cold,
      ),
    ).toBe(false);
    expect(
      chooseWarmByModel(
        {
          layout: { bbox: 5, maxHeightBounds: 0, rectList: 2 },
          patchDominates: true,
        },
        cold,
      ),
    ).toBe(false);
    expect(
      chooseWarmByModel(
        {
          layout: { bbox: 5, maxHeightBounds: 0, rectList: 2 },
          scalarPatchCredit: 2,
        },
        cold,
      ),
    ).toBe(true);
    expect(
      chooseWarmByModel(
        {
          layout: { bbox: 3, maxHeightBounds: 0, rectList: 3 },
          patchDominates: true,
        },
        cold,
      ),
    ).toBe(false);
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
