// Two default local expansion steps capture normal resize deltas while bounding
// the penalty when a previous answer is far from the new fit boundary.
export const defaultWarmExpansionLimit = 2;
export const richWarmExpansionLimit = defaultWarmExpansionLimit + 1;

type TargetInput = {
  readonly allowPatchTieBreak?: boolean;
  readonly coldCost: number;
  readonly count: number;
  readonly expansionLimit?: number;
  readonly hint: number;
  readonly target: number;
};

// For monotonic predicates, rejecting an index also rejects every larger index.
function* binarySearchLastFit(
  low: number,
  high: number,
  best = -1,
): Generator<number, number, boolean> {
  let currentLow = low;
  let currentHigh = high;
  let currentBest = best;

  while (currentLow <= currentHigh) {
    const index = Math.floor((currentLow + currentHigh) / 2);

    if (yield index) {
      currentBest = index;
      currentLow = index + 1;
    } else {
      currentHigh = index - 1;
    }
  }

  return currentBest;
}

function binarySearchLargestFittingCount(
  low: number,
  high: number,
  fits: (count: number) => boolean,
): number {
  let floor = low;
  let ceiling = high;

  while (floor < ceiling) {
    const count = Math.ceil((floor + ceiling) / 2);

    if (fits(count)) {
      floor = count;
    } else {
      ceiling = count - 1;
    }
  }

  return floor;
}

export function findLastFittingIndex(
  count: number,
  fits: (index: number) => boolean,
  hint?: number | null,
  expansionLimit = defaultWarmExpansionLimit,
): number {
  const search = searchFittingIndex(count, hint, expansionLimit);
  let step = search.next();
  while (!step.done) {
    step = search.next(fits(step.value));
  }
  return step.value;
}

// The same search can be driven synchronously or suspended between a candidate
// write and its fit read, allowing independent components to share a layout pass.
export function* searchFittingIndex(
  count: number,
  hint?: number | null,
  expansionLimit = defaultWarmExpansionLimit,
  monotonic = true,
): Generator<number, number, boolean> {
  if (count <= 0) {
    return -1;
  }

  const maxIndex = count - 1;

  if (!monotonic) {
    // A rejected cut cannot bound later candidates when shaping can reduce
    // their width. Descending evaluation proves maximality without a lookahead cap.
    for (let index = maxIndex; index >= 0; index -= 1) {
      if (yield index) return index;
    }
    return -1;
  }

  if (hint == null || !Number.isFinite(hint)) {
    return yield* binarySearchLastFit(0, maxIndex);
  }

  const start = Math.max(0, Math.min(maxIndex, Math.floor(hint)));

  if (yield start) {
    // Growing from a fitting hint favors the common case where a container gets
    // a little wider and only a few more candidates may now fit.
    let fit = start;
    let step = 1;
    let expansions = 0;

    while (fit < maxIndex) {
      const probe = Math.min(maxIndex, fit + step);

      if (!(yield probe)) {
        return yield* binarySearchLastFit(fit + 1, probe - 1, fit);
      }

      fit = probe;
      expansions += 1;
      if (expansions >= expansionLimit) {
        return yield* binarySearchLastFit(fit + 1, maxIndex, fit);
      }

      step *= 2;
    }

    return fit;
  }

  let failed = start;
  let step = 1;
  let expansions = 0;

  while (failed > 0) {
    // Shrinking from a failing hint handles the opposite resize direction
    // without restarting from the middle of the whole candidate set.
    const probe = Math.max(0, failed - step);

    if (yield probe) {
      return yield* binarySearchLastFit(probe + 1, failed - 1, probe);
    }

    failed = probe;
    expansions += 1;
    if (expansions >= expansionLimit) {
      return yield* binarySearchLastFit(0, failed - 1);
    }

    step *= 2;
  }

  return -1;
}

export function warmSearchLocalCoverage(expansionLimit = defaultWarmExpansionLimit): number {
  return 2 ** expansionLimit - 1;
}

export function estimateColdSearchMaxProbeCount(count: number): number {
  return count <= 0 ? 0 : Math.ceil(Math.log2(count + 1));
}

function normalizedTarget(maxIndex: number, target: number): number {
  if (!Number.isFinite(target)) {
    return target === Number.POSITIVE_INFINITY ? maxIndex : -1;
  }

  return Math.max(-1, Math.min(maxIndex, Math.floor(target)));
}

function warmProbeCount(
  count: number,
  hint: number,
  target: number,
  expansionLimit = defaultWarmExpansionLimit,
): number {
  if (count <= 0) {
    return 0;
  }

  if (!Number.isFinite(hint)) {
    return Number.POSITIVE_INFINITY;
  }

  const targetIndex = normalizedTarget(count - 1, target);
  let probes = 0;
  findLastFittingIndex(
    count,
    (index) => {
      probes += 1;
      return index <= targetIndex;
    },
    hint,
    expansionLimit,
  );
  return probes;
}

export function warmTargetBeatsCold({
  allowPatchTieBreak = false,
  coldCost,
  count,
  expansionLimit = defaultWarmExpansionLimit,
  hint,
  target,
}: TargetInput): boolean {
  const warmCost = warmProbeCount(count, hint, target, expansionLimit);

  return warmCost < coldCost || (allowPatchTieBreak && warmCost === coldCost);
}

export function shouldVerifyFullCandidate(
  skipFullFit: boolean,
  width: number,
  previousWidth: number | null | undefined,
  previousWasFull: boolean,
  clampedMaxWidth: number | null | undefined,
): boolean {
  if (!skipFullFit || previousWidth == null || width === previousWidth) {
    return true;
  }

  return (
    width > previousWidth && (previousWasFull || clampedMaxWidth == null || width > clampedMaxWidth)
  );
}

export function findLargestFittingCount(
  low: number,
  high: number,
  fits: (count: number) => boolean,
  hint?: number | null,
): number {
  if (high <= low) {
    return low;
  }

  if (hint == null || !Number.isFinite(hint)) {
    // Count searches often mutate DOM in their predicate. Keep the no-hint path
    // on the original ceil-midpoint probe order so those reads do not regress.
    return binarySearchLargestFittingCount(low, high, fits);
  }

  const offsetHint = Math.floor(hint) - low;
  const fittingOffset = findLastFittingIndex(
    high - low + 1,
    (offset) => fits(low + offset),
    offsetHint,
  );

  // Count searches are called with a known-safe lower bound. Preserve that
  // fallback if an unusual predicate rejects every probed candidate.
  return fittingOffset < 0 ? low : low + fittingOffset;
}
