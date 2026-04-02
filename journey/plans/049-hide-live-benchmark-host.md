# Hide Live Benchmark Host Again

## Goal

Keep the actual benchmark rendering offscreen during runs, while preserving real-time per-scenario stats in the table and showing representative scenario previews only after the benchmark finishes.

## Constraints

- Do not change benchmark scenarios, timing windows, or the incremental finished-scenario stats behavior.
- Restore the hidden benchmark host so measurements do not depend on the visible table row layout.
- Keep the unified scenario table and post-run expandable previews.

## Plan

1. Simplify the runner back to a fixed hidden benchmark container instead of a per-scenario dynamic host.
2. Remove the visible live-lab row behavior and auto-expansion while running from the benchmark page.
3. Keep `onScenarioResult` so finished rows still populate ratios and bars immediately.
4. Show the preview component only when the benchmark is not running.
5. Validate with `vp check`, `vp test`, and `vp run build -r`.
