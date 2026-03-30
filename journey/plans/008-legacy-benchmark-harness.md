# Legacy Algorithm Benchmark Harness

## Goal

Implement benchmarkable versions of the legacy DOM-search algorithm, an optimized legacy-derived variant, and the current Pretext-based approach, then compare them across realistic browser scenarios.

## Scope

- Add an internal implementation of the old DOM-search clamp algorithm for benchmark use.
- Add an optimized legacy-derived benchmark engine focused on eliminating redundant DOM work.
- Add a browser-run benchmark harness that compares all three approaches under the same live DOM conditions.
- Cover multiple scenarios: single clamp, width changes, text changes, different clamp locations, slot widths, and batch relayout.
- Expose the benchmark in `apps/website` so it can be run manually and through browser automation.
- Record measured results and architectural conclusions in `journey/`.

## Non-Goals

- Reintroducing the legacy engine into the published package API.
- Using jsdom microbenchmarks as the source of truth.
- Treating one benchmark run as a final architectural decision without documenting the environment.

## Action Plan

1. Implement benchmark engines.
   - Add an internal legacy DOM-search benchmark engine based on the old `master` behavior.
   - Add an optimized legacy-derived engine that preserves legacy output semantics while removing redundant probing work.
   - Add a matching Pretext benchmark engine that uses the current measurement + compute path.

2. Build the browser harness.
   - Add benchmark scenarios and a benchmark page in `apps/website`.
   - Expose a programmatic browser API for running all scenarios and collecting results.

3. Run and record benchmarks.
   - Launch the website locally.
   - Run the benchmark page in a real browser.
   - Record the measured results and conclusions in `journey/logs/008-legacy-benchmark-harness.md`.

4. Validate.
   - Run `vp check`, `vp test`, and `vp run build -r`.

## Progress

- [x] 1. Implement benchmark engines
- [x] 2. Build the browser harness
- [x] 3. Run and record benchmarks
- [x] 4. Validate
