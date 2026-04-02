# Incremental Benchmark Scenario Stats

## Goal

Show per-scenario benchmark stats as soon as each scenario finishes instead of waiting for the full suite to complete.

## Constraints

- Do not change the measured benchmark behavior, scenario definitions, or final report shape.
- Keep the existing single scenario table and final summary table layout.
- Limit the change to progress/result data flow between the runner and benchmark page.

## Plan

1. Extend the benchmark runner with a completion callback that emits each finished `BenchmarkScenarioReport`.
2. Track completed scenario reports separately in the benchmark page while the run is still in progress.
3. Feed the unified scenario-row model from completed scenario reports first, then replace them with the final report when the full run resolves.
4. Keep the final summary table on the final report path only, so partial rows update early without changing the end-of-run summary contract.
5. Validate with `vp check`, `vp test`, and `vp run build -r`.
