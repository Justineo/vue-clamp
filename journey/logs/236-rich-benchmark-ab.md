# 2026-04-09 Rich benchmark A/B

- Started an A/B benchmark pass for the current rich clamp helper versus the pre-optimization
  helper.
- Plan is to keep the comparison browser-based and scenario-driven rather than using synthetic
  microbenchmarks alone.
- Added:
  - `packages/vue-clamp/tests/legacy-rich.ts` as a benchmark-only copy of the pre-optimization
    helper
  - `packages/vue-clamp/tests/rich.browser.benchmark.ts` as the browser A/B harness
  - `benchmark:rich` in the root `package.json`
- Latest benchmark run via `vp run benchmark:rich`:
  - `fit-width-sweep`
    - current median total: `0.30ms`
    - legacy median total: `0.40ms`
    - delta: current `25.0%` faster
  - `truncate-width-sweep`
    - current median total: `2.60ms`
    - legacy median total: `3.55ms`
    - delta: current `26.8%` faster
  - `dense-grid-width-sweep`
    - current median total: `68.10ms`
    - legacy median total: `81.80ms`
    - delta: current `16.7%` faster
- Observed metric shape:
  - `getBoundingClientRect` reads stayed flat across current and legacy
  - `getClientRects` reads stayed flat across current and legacy
  - the win comes from cheaper non-layout work per clamp probe, which is consistent with the latest
    optimization pass
- Follow-up decision:
  - keep this A/B comparison as a historical record only
  - remove the benchmark-only legacy helper after logging the numbers
  - keep `packages/vue-clamp/tests/rich.browser.benchmark.ts` as a current-only workload benchmark
