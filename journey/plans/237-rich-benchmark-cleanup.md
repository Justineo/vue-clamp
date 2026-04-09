# Rich benchmark cleanup

## Goals

- Keep the rich benchmark as a current-only workload benchmark.
- Preserve the measured current-versus-legacy numbers in journey logs.
- Remove the benchmark-only legacy implementation so the repo only carries the shipped runtime.

## Plan

1. Simplify `packages/vue-clamp/tests/rich.browser.benchmark.ts` to benchmark only the current rich
   clamp helper across the existing workload scenarios.
2. Delete `packages/vue-clamp/tests/legacy-rich.ts` and remove any design-note references that imply
   an ongoing A/B benchmark surface.
3. Update journey notes to record that the comparison numbers were logged and the legacy helper was
   intentionally removed afterward.
4. Re-run `vp check` and `vp run benchmark:rich`.
