import { defaultWarmExpansionLimit } from "../src/search.ts";

export type RankAdvance = {
  readonly max: number;
  readonly min: number;
};

export type TargetRankInterval = {
  readonly max: number;
  readonly min: number;
};

export type TargetRankIntervalInput = {
  readonly advance: RankAdvance;
  readonly lineCapacity: number;
  readonly nextWidth: number;
  readonly packingSlack?: number;
  readonly previousRank: number;
  readonly previousWidth: number;
  readonly rankCount: number;
  readonly shrinkLineBreaksKnown?: boolean;
};

export type TargetRankLocalIntervalInput = TargetRankIntervalInput & {
  readonly advances: readonly number[];
};

export type WarmColdProbeCost = {
  readonly coldMin: number;
  readonly warmMax: number;
};

export type WarmColdDecision = WarmColdProbeCost & {
  readonly requiredCredit: number;
  readonly useWarm: boolean;
};

export type WarmColdProbeCostInput = {
  readonly coldExtraCost?: number;
  readonly count: number;
  readonly expansionLimit?: number;
  readonly hint: number;
  readonly interval: TargetRankInterval;
};

export type WarmColdDecisionInput = WarmColdProbeCostInput & {
  readonly allowPatchTieBreak?: boolean;
  readonly warmCredit?: number;
};

export type WarmSearchDirection = -1 | 1;

export type WarmSearchRankRoomInput = Omit<WarmColdDecisionInput, "interval"> & {
  readonly direction?: WarmSearchDirection;
};

export type WarmSearchRankRoom = {
  readonly maxRankMove: number;
  readonly useWarm: boolean;
};

export type WarmSearchWidthRoom = WarmSearchRankRoom & {
  readonly widthDeltaLimit: number;
};

export type WarmSearchAdvanceWindow = WarmSearchRankRoom & {
  readonly indexes: readonly number[];
  readonly unbounded: boolean;
};

export type WarmSearchWidthRoomInput = WarmSearchRankRoomInput & {
  readonly advances: readonly number[];
  readonly lineCapacity: number;
  readonly packingSlack?: number;
  readonly shrinkLineBreaksKnown?: boolean;
};

function clampRank(rank: number, maxRank: number): number {
  return Math.max(-1, Math.min(maxRank, Math.floor(rank)));
}

function fullInterval(rankCount: number): TargetRankInterval {
  return {
    max: Math.max(-1, rankCount - 1),
    min: -1,
  };
}

function shrinkSlack(slack: number, lineCapacity: number, lineBreaksKnown = false): number {
  return lineCapacity === 1 || lineBreaksKnown ? slack : 0;
}

export function estimateTargetRankInterval({
  advance,
  lineCapacity,
  nextWidth,
  packingSlack,
  previousRank,
  previousWidth,
  rankCount,
  shrinkLineBreaksKnown,
}: TargetRankIntervalInput): TargetRankInterval {
  const maxRank = rankCount - 1;

  if (rankCount <= 0) {
    return { max: -1, min: -1 };
  }

  if (
    !Number.isFinite(previousWidth) ||
    !Number.isFinite(nextWidth) ||
    !Number.isFinite(lineCapacity) ||
    !Number.isFinite(advance.min) ||
    !Number.isFinite(advance.max) ||
    lineCapacity <= 0 ||
    advance.min <= 0 ||
    advance.max <= 0
  ) {
    return fullInterval(rankCount);
  }

  const rank = clampRank(previousRank, maxRank);
  const widthDelta = nextWidth - previousWidth;
  if (widthDelta === 0) {
    return { max: rank, min: rank };
  }

  const capacityDelta = Math.abs(widthDelta) * lineCapacity;
  const hasSlack = packingSlack !== undefined && Number.isFinite(packingSlack) && packingSlack >= 0;
  const slack = hasSlack ? packingSlack : 0;
  const growSlack = hasSlack
    ? slack
    : lineCapacity === 1
      ? Math.max(advance.min, advance.max)
      : previousWidth * lineCapacity;
  const lossSlack = shrinkSlack(slack, lineCapacity, shrinkLineBreaksKnown);
  const move =
    widthDelta > 0
      ? Math.max(0, Math.ceil((capacityDelta + growSlack) / advance.min))
      : Math.max(0, Math.ceil(Math.max(0, capacityDelta - lossSlack) / advance.min));

  return widthDelta > 0
    ? { max: clampRank(rank + move, maxRank), min: rank }
    : { max: rank, min: clampRank(rank - move, maxRank) };
}

function positive(values: readonly number[]): number[] {
  return values.filter((value) => Number.isFinite(value) && value > 0);
}

function localGrowMove(
  advances: readonly number[],
  start: number,
  maxRank: number,
  budget: number,
): number | null {
  let move = 0;
  let used = 0;

  for (let index = start; index < maxRank; index += 1) {
    const advance = advances[index];
    if (advance === undefined || !Number.isFinite(advance) || advance <= 0) {
      return null;
    }

    if (used + advance > budget) {
      break;
    }

    used += advance;
    move += 1;
  }

  return move;
}

function localShrinkMove(
  advances: readonly number[],
  start: number,
  deficit: number,
): number | null {
  if (deficit <= 0) {
    return 0;
  }

  let freed = 0;
  let move = 0;

  for (let index = start - 1; index >= 0; index -= 1) {
    const advance = advances[index];
    if (advance === undefined || !Number.isFinite(advance) || advance <= 0) {
      return null;
    }

    freed += advance;
    move += 1;
    if (freed >= deficit) {
      return move;
    }
  }

  return start + 1;
}

export function estimateTargetRankLocalInterval({
  advance,
  advances,
  lineCapacity,
  nextWidth,
  packingSlack,
  previousRank,
  previousWidth,
  rankCount,
  shrinkLineBreaksKnown,
}: TargetRankLocalIntervalInput): TargetRankInterval {
  const fallback = estimateTargetRankInterval({
    advance,
    lineCapacity,
    nextWidth,
    ...(packingSlack === undefined ? {} : { packingSlack }),
    previousRank,
    previousWidth,
    rankCount,
    ...(shrinkLineBreaksKnown === undefined ? {} : { shrinkLineBreaksKnown }),
  });
  const maxRank = rankCount - 1;

  if (rankCount <= 0) {
    return fallback;
  }

  const localAdvances = positive(advances);
  if (
    localAdvances.length === 0 ||
    !Number.isFinite(previousWidth) ||
    !Number.isFinite(nextWidth) ||
    !Number.isFinite(lineCapacity) ||
    lineCapacity <= 0
  ) {
    return fallback;
  }

  const rank = clampRank(previousRank, maxRank);
  const widthDelta = nextWidth - previousWidth;
  if (widthDelta === 0) {
    return { max: rank, min: rank };
  }

  const capacityDelta = Math.abs(widthDelta) * lineCapacity;
  const hasSlack = packingSlack !== undefined && Number.isFinite(packingSlack) && packingSlack >= 0;
  const slack = hasSlack ? packingSlack : 0;
  const growSlack = hasSlack
    ? slack
    : lineCapacity === 1
      ? Math.max(...localAdvances)
      : previousWidth * lineCapacity;
  const lossSlack = shrinkSlack(slack, lineCapacity, shrinkLineBreaksKnown);
  const move =
    widthDelta > 0
      ? localGrowMove(advances, rank, maxRank, capacityDelta + growSlack)
      : localShrinkMove(advances, rank, capacityDelta - lossSlack);

  if (move === null) {
    return fallback;
  }

  const interval =
    widthDelta > 0
      ? { max: clampRank(rank + move, maxRank), min: rank }
      : { max: rank, min: clampRank(rank - move, maxRank) };

  return {
    max: Math.min(interval.max, fallback.max),
    min: Math.max(interval.min, fallback.min),
  };
}

function binaryProbeCount(low: number, high: number, target: number): number {
  let floor = low;
  let ceiling = high;
  let probes = 0;

  while (floor <= ceiling) {
    const index = Math.floor((floor + ceiling) / 2);
    probes += 1;

    if (index <= target) {
      floor = index + 1;
    } else {
      ceiling = index - 1;
    }
  }

  return probes;
}

function normalizedTarget(maxIndex: number, target: number): number {
  if (!Number.isFinite(target)) {
    return target === Number.POSITIVE_INFINITY ? maxIndex : -1;
  }

  return Math.max(-1, Math.min(maxIndex, Math.floor(target)));
}

export function estimateColdSearchProbeCount(count: number, target: number): number {
  if (count <= 0) {
    return 0;
  }

  const maxIndex = count - 1;
  return binaryProbeCount(0, maxIndex, normalizedTarget(maxIndex, target));
}

export function estimateWarmSearchProbeCount(
  count: number,
  hint: number,
  target: number,
  expansionLimit = defaultWarmExpansionLimit,
): number {
  if (count <= 0) {
    return 0;
  }

  if (!Number.isFinite(hint)) {
    return estimateColdSearchProbeCount(count, target);
  }

  const maxIndex = count - 1;
  const start = Math.max(0, Math.min(maxIndex, Math.floor(hint)));
  const targetIndex = normalizedTarget(maxIndex, target);
  let probes = 1;

  if (start <= targetIndex) {
    let fit = start;
    let step = 1;
    let expansions = 0;

    while (fit < maxIndex) {
      const probe = Math.min(maxIndex, fit + step);
      probes += 1;

      if (probe > targetIndex) {
        return probes + binaryProbeCount(fit + 1, probe - 1, targetIndex);
      }

      fit = probe;
      expansions += 1;
      if (expansions >= expansionLimit) {
        return probes + binaryProbeCount(fit + 1, maxIndex, targetIndex);
      }

      step *= 2;
    }

    return probes;
  }

  let failed = start;
  let step = 1;
  let expansions = 0;

  while (failed > 0) {
    const probe = Math.max(0, failed - step);
    probes += 1;

    if (probe <= targetIndex) {
      return probes + binaryProbeCount(probe + 1, failed - 1, targetIndex);
    }

    failed = probe;
    expansions += 1;
    if (expansions >= expansionLimit) {
      return probes + binaryProbeCount(0, failed - 1, targetIndex);
    }

    step *= 2;
  }

  return probes;
}

export function warmSearchCanBeatColdByCost(
  warmCost: number,
  coldCost: number,
  allowTieBreak = false,
  warmCredit = 0,
): boolean {
  const creditedWarmCost = warmCost - warmCredit;

  return creditedWarmCost < coldCost || (allowTieBreak && creditedWarmCost === coldCost);
}

export function estimateWarmColdProbeCost({
  coldExtraCost = 0,
  count,
  expansionLimit = defaultWarmExpansionLimit,
  hint,
  interval,
}: WarmColdProbeCostInput): WarmColdProbeCost {
  const extraColdCost = Number.isFinite(coldExtraCost) ? Math.max(0, coldExtraCost) : 0;

  if (count <= 0) {
    return {
      coldMin: extraColdCost,
      warmMax: 0,
    };
  }

  const maxIndex = count - 1;
  const minTarget = normalizedTarget(maxIndex, Math.min(interval.min, interval.max));
  const maxTarget = normalizedTarget(maxIndex, Math.max(interval.min, interval.max));
  let coldMin = Number.POSITIVE_INFINITY;
  let warmMax = 0;

  for (let target = minTarget; target <= maxTarget; target += 1) {
    coldMin = Math.min(coldMin, extraColdCost + estimateColdSearchProbeCount(count, target));
    warmMax = Math.max(warmMax, estimateWarmSearchProbeCount(count, hint, target, expansionLimit));
  }

  return { coldMin, warmMax };
}

function requiredCredit(cost: WarmColdProbeCost, allowTieBreak: boolean): number {
  const gap = cost.warmMax - cost.coldMin;

  return Math.max(0, allowTieBreak ? gap : gap + 1);
}

export function warmSearchDecision({
  allowPatchTieBreak = false,
  warmCredit = 0,
  ...input
}: WarmColdDecisionInput): WarmColdDecision {
  const cost = estimateWarmColdProbeCost(input);

  return {
    ...cost,
    requiredCredit: requiredCredit(cost, allowPatchTieBreak),
    useWarm: warmSearchCanBeatColdByCost(
      cost.warmMax,
      cost.coldMin,
      allowPatchTieBreak,
      warmCredit,
    ),
  };
}

export function warmSearchCanBeatCold(input: WarmColdDecisionInput): boolean {
  return warmSearchDecision(input).useWarm;
}

export function requiredWholeWarmCredit(input: WarmColdDecisionInput): number {
  return warmSearchDecision(input).requiredCredit;
}

function intervalBetween(start: number, target: number): TargetRankInterval {
  return {
    max: Math.max(start, target),
    min: Math.min(start, target),
  };
}

export function estimateWarmSearchRankRoom({
  direction = 1,
  ...input
}: WarmSearchRankRoomInput): WarmSearchRankRoom {
  if (input.count <= 0 || !Number.isFinite(input.hint)) {
    return { maxRankMove: 0, useWarm: false };
  }

  const maxIndex = input.count - 1;
  const start = Math.max(0, Math.min(maxIndex, Math.floor(input.hint)));
  const maxMove = direction > 0 ? maxIndex - start : start + 1;
  let room = 0;
  let useWarm = false;

  for (let move = 0; move <= maxMove; move += 1) {
    const target = start + direction * move;
    if (
      !warmSearchDecision({
        ...input,
        hint: start,
        interval: intervalBetween(start, target),
      }).useWarm
    ) {
      break;
    }

    room = move;
    useWarm = true;
  }

  return { maxRankMove: room, useWarm };
}

function advanceBudget(advances: readonly number[], indexes: readonly number[]): number | null {
  let budget = 0;

  for (const index of indexes) {
    const advance = advances[index];
    if (advance === undefined || !Number.isFinite(advance) || advance <= 0) {
      return null;
    }

    budget += advance;
  }

  return budget;
}

export function warmSearchAdvanceWindow({
  direction = 1,
  ...input
}: WarmSearchRankRoomInput): WarmSearchAdvanceWindow {
  const room = estimateWarmSearchRankRoom({ ...input, direction });
  if (input.count <= 0 || !Number.isFinite(input.hint) || !room.useWarm) {
    return { ...room, indexes: [], unbounded: false };
  }

  const maxIndex = input.count - 1;
  const start = Math.max(0, Math.min(maxIndex, Math.floor(input.hint)));
  const maxMove = direction > 0 ? maxIndex - start : start + 1;
  const move = direction > 0 ? room.maxRankMove + 1 : room.maxRankMove;

  if (move > maxMove) {
    return { ...room, indexes: [], unbounded: true };
  }

  return {
    ...room,
    indexes: Array.from({ length: move }, (_, step) =>
      direction > 0 ? start + step : start - 1 - step,
    ),
    unbounded: false,
  };
}

export function estimateWarmSearchWidthRoom({
  advances,
  direction = 1,
  lineCapacity,
  packingSlack,
  shrinkLineBreaksKnown,
  ...input
}: WarmSearchWidthRoomInput): WarmSearchWidthRoom {
  const window = warmSearchAdvanceWindow({ ...input, direction });
  const { indexes, unbounded, ...room } = window;

  if (
    input.count <= 0 ||
    !Number.isFinite(input.hint) ||
    !Number.isFinite(lineCapacity) ||
    lineCapacity <= 0
  ) {
    return { ...room, widthDeltaLimit: 0 };
  }

  if (!room.useWarm) {
    return { ...room, widthDeltaLimit: 0 };
  }

  if (unbounded) {
    return { ...room, widthDeltaLimit: Number.POSITIVE_INFINITY };
  }

  const nextBudget = advanceBudget(advances, indexes);
  if (nextBudget === null) {
    return { ...room, widthDeltaLimit: 0 };
  }

  const hasSlack = packingSlack !== undefined && Number.isFinite(packingSlack) && packingSlack >= 0;
  const slack = hasSlack ? packingSlack : 0;
  const localAdvances = positive(advances);
  if (direction > 0 && localAdvances.length === 0) {
    return { ...room, widthDeltaLimit: 0 };
  }

  if (direction > 0 && !hasSlack && lineCapacity > 1) {
    return { ...room, widthDeltaLimit: 0 };
  }

  const growSlack = hasSlack ? slack : Math.max(...localAdvances) * lineCapacity;
  const lossSlack = shrinkSlack(slack, lineCapacity, shrinkLineBreaksKnown);

  return {
    ...room,
    widthDeltaLimit:
      direction > 0
        ? Math.max(0, (nextBudget - growSlack) / lineCapacity)
        : Math.max(0, (nextBudget + lossSlack) / lineCapacity),
  };
}
