# WrapClamp benchmark validity fixes

## Goal

Fix the dedicated `WrapClamp` benchmark so its conclusions are attributable to the component variants instead of harness artifacts.

## Issues to fix

- Each benchmark run currently leaves mounted apps alive until `afterEach`, so later runs execute in a dirtier page.
- Step timing currently waits a fixed number of frames instead of waiting for the component to settle.
- The harness does not prove that the compared variants render the same final result at each width.
- The width sweep currently includes an initial no-op step.
- The one-line scenario does not exercise the `before` slot side of the one-line hint layer.

## Direction

- Unmount every mounted benchmark instance at the end of each scenario run.
- Replace fixed `settle(4)` measurement with a wait-for-stable-state helper.
- Capture compact rendered snapshots and assert equality between `WrapClamp` and `WrapClampWithoutOneLineHints` for every measured width.
- Exclude the initial mounted width from measured steps.
- Add a `before` slot to the one-line scenario so the benchmark exercises all cached one-line width buckets.

## Validation

- `vp check`
- `vp test -c vite.browser.benchmark.config.ts`
