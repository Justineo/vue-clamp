# Benchmark And Component Simplification Pass

## Goal

Address the remaining review findings by simplifying benchmark UI structure, clarifying preview responsibilities, adding benchmark-page integration coverage, and tightening the clamp component state flow without changing behavior.

## Scope

- `packages/website/src/BenchmarkScenarioPreview.vue`
- `packages/website/src/BenchmarkPage.vue`
- `packages/website/src/benchmark/runBenchmarks.ts`
- benchmark page presentation helpers as needed
- `packages/vue-clamp/tests/benchmark.browser.test.ts`
- `packages/vue-clamp/src/component.ts`

## Plan

1. Split the mixed benchmark preview responsibilities so the real `Clamp` scenario preview and the synthetic DOM-engine previews are explicit in code.
2. Extract pure benchmark presentation helpers/row modeling out of `BenchmarkPage.vue` so the SFC mainly coordinates state and markup.
3. Add one focused browser integration test around the benchmark page state machine, covering row status progression, incremental completed-row stats, and post-run preview visibility.
4. Simplify `component.ts` by consolidating the overlapping wait/bypass/measure/render-mode decisions into a small pure helper layer while keeping the file flat.
5. Run `vp check`, `vp test`, and `vp run build -r`, then update `journey/design.md` and a matching log with the new structure.
