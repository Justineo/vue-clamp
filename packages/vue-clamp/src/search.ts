// Two local expansion steps capture normal resize deltas while bounding the
// penalty when a previous answer is far from the new fit boundary.
const warmExpansionLimit = 2;

// The clamp predicates are monotonic: once an index stops fitting, larger
// indexes cannot fit. The helper searches for the highest index that still fits.
function binarySearchLastFit(
  low: number,
  high: number,
  fits: (index: number) => boolean,
  best = -1,
): number {
  let currentLow = low;
  let currentHigh = high;
  let currentBest = best;

  while (currentLow <= currentHigh) {
    const index = Math.floor((currentLow + currentHigh) / 2);

    if (fits(index)) {
      currentBest = index;
      currentLow = index + 1;
    } else {
      currentHigh = index - 1;
    }
  }

  return currentBest;
}

export function findLastFittingIndex(
  count: number,
  fits: (index: number) => boolean,
  hint?: number | null,
): number {
  if (count <= 0) {
    return -1;
  }

  const maxIndex = count - 1;

  if (hint == null || !Number.isFinite(hint)) {
    return binarySearchLastFit(0, maxIndex, fits);
  }

  const start = Math.max(0, Math.min(maxIndex, Math.floor(hint)));

  if (fits(start)) {
    // Growing from a fitting hint favors the common case where a container gets
    // a little wider and only a few more candidates may now fit.
    let fit = start;
    let step = 1;
    let expansions = 0;

    while (fit < maxIndex) {
      const probe = Math.min(maxIndex, fit + step);

      if (!fits(probe)) {
        return binarySearchLastFit(fit + 1, probe - 1, fits, fit);
      }

      fit = probe;
      expansions += 1;
      if (expansions >= warmExpansionLimit) {
        return binarySearchLastFit(fit + 1, maxIndex, fits, fit);
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

    if (fits(probe)) {
      return binarySearchLastFit(probe + 1, failed - 1, fits, probe);
    }

    failed = probe;
    expansions += 1;
    if (expansions >= warmExpansionLimit) {
      return binarySearchLastFit(0, failed - 1, fits);
    }

    step *= 2;
  }

  return -1;
}
