# 076 Componentized Legacy Benchmark

Superseded by `journey/plans/077-production-legacy-component-benchmark.md`.

## Goal

Make the legacy benchmark path a Vue component and move the benchmark comparison onto a shared component-based harness so the three benchmark rows are measured under the same structural model.

## Scope

1. Add benchmark-only component wrappers for the compared engines.
2. Introduce a legacy algorithm component.
3. Switch the benchmark runner from imperative fixture adapters to mounted benchmark components.
4. Update the benchmark preview/UI to match the new benchmark harness.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build -r`

## Outcome

- The benchmark now compares three benchmark-only Vue component wrappers under the same shell.
- The legacy algorithm has its own benchmark component wrapper.
- The benchmark runner and preview both use the component layer instead of raw imperative fixture rendering.
