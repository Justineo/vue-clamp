# Benchmark Scope And Density Simplification

## Goal

Simplify the benchmark suite and the benchmark page so they focus on the only comparisons that matter now:

- production Pretext implementation
- optimized DOM baseline
- legacy DOM baseline

The page should maximize information density and stop behaving like a report or dashboard. It should read as a compact performance comparison artifact.

## Scope Changes

1. Benchmark engines
   - keep only three engines in the comparison UI and report data:
     - `pretext`
     - `optimized-dom`
     - `legacy-dom`
   - remove the old `current-pretext` benchmark path from the benchmark page and report model

2. File layout
   - move DOM comparison engines into `packages/vue-clamp/src/benchmark/dom/`
   - keep the Pretext benchmark path at the top benchmark folder level because it represents the main implementation

3. Visualization
   - replace the current report layout with a denser table/chart hybrid
   - use a compact summary table plus one dense scenario comparison table with inline grouped bars
   - remove oversized framing, repeated methodology blocks, and per-scenario split plot/table structure

## Target Page Structure

1. Compact header
   - title
   - run button
   - one short methodology line
2. Summary table
   - engine
   - wins
   - geomean vs baseline
   - median scenario time
3. Dense scenario comparison table
   - scenario label
   - compact workload tags
   - inline grouped bar chart for the three engines
   - exact median numbers
   - compact relative speedups for Pretext vs DOM baselines
4. Supporting details
   - optional environment section
   - raw JSON in details

## Implementation Plan

1. Re-scope the benchmark data model in `runBenchmarks.ts`.
   - remove `current-pretext` from the comparison set
   - rename the production engine identifier to something shorter and clearer
   - simplify summary fields accordingly

2. Move DOM comparison implementations.
   - move legacy DOM benchmark file into `packages/vue-clamp/src/benchmark/dom/`
   - move optimized DOM benchmark file into `packages/vue-clamp/src/benchmark/dom/`
   - update imports accordingly

3. Simplify the benchmark page.
   - rebuild `BenchmarkPage.vue` around one compact summary table and one dense scenario table
   - use small inline grouped bars instead of a separate plot section per scenario
   - keep text concise and repetitive structure minimal

4. Remove no-longer-needed report complexity.
   - delete unused statistical helpers if they are no longer part of the page
   - remove unused methodology fields and derived report logic

5. Validate and document.
   - `vp check`
   - `vp test`
   - `vp run build -r`
   - browser verification
   - update `journey/logs` and `journey/design.md`

## Progress

- [x] Reduce the benchmark comparison scope to `pretext`, `optimized-dom`, and `legacy-dom`.
- [x] Move DOM benchmark implementations into `packages/vue-clamp/src/benchmark/dom/`.
- [x] Remove the obsolete `current-pretext` benchmark path from the website benchmark model.
- [x] Replace the report-style page with a dense summary table plus scenario table using inline grouped bars.
- [x] Delete no-longer-needed report-layer statistics helpers.
- [x] Validate with `vp check`, `vp test`, and `vp run build -r`.
- [x] Verify the live page in headless Chromium at desktop and narrow widths.
