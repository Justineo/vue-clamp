# WrapClamp one-line hint benchmark

## Goal

Quantify the current `WrapClamp` one-line hint path against the same runtime with that hint layer disabled.

## Direction

- Keep the benchmark internal-only; do not change the public component API.
- Compare two otherwise identical variants:
  - `WrapClamp`
  - `WrapClampWithoutOneLineHints`
- Measure two workloads:
  - one-line width sweeps where the hint path is eligible
  - table-demo style width sweeps where the hint path should not matter
- Record browser-side metrics that reflect real work:
  - total elapsed time
  - mean time per width step
  - DOM geometry reads
  - slot invocation counts
- Run multiple iterations and summarize medians rather than relying on a single noisy pass.

## Validation

- `vp check --fix`
- `vp check`
- `vp test -c vite.browser.benchmark.config.ts`
