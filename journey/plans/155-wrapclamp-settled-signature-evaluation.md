# WrapClamp settled-layout-signature evaluation

## Goal

Quantify whether `settledLayoutSignature` is doing useful work in the current `WrapClamp` implementation.

## Method

- Use the existing browser benchmark as the baseline with the current implementation.
- Temporarily disable the signature check in the `ResizeObserver` path.
- Rerun the same benchmark and compare:
  - median total time
  - median step time
  - `getBoundingClientRect()` calls
- Restore the original implementation after the experiment.

## Validation

- `vp test -c vite.browser.benchmark.config.ts`
