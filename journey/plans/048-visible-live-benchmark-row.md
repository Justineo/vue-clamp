# Visible Live Benchmark Row

## Goal

Show the actual benchmark fixtures live inside the currently running scenario row instead of rendering them only in the hidden offscreen lab.

## Constraints

- Keep the benchmark scenario definitions and engine execution logic intact.
- Preserve the unified scenario table and final summary table.
- Only one scenario runs at a time, so only one row needs the live benchmark container.
- Finished scenarios should retain their completed stats even before the full report resolves.

## Plan

1. Extend the benchmark runner so the page can provide the benchmark container dynamically for each scenario.
2. Keep partial finished-scenario reports in the page so row stats appear as scenarios complete.
3. Force the running scenario row open and mount the live benchmark container inside that row while it is active.
4. Fall back to the regular preview component for non-running rows.
5. Validate with `vp check`, `vp test`, and `vp run build -r`.
