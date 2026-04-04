# WrapClamp one-line hint benchmark

## Status

Historical comparison note. This benchmark and the follow-up validity fixes led to removing the one-line hint layer from production `WrapClamp`. The live benchmark harness now measures current workloads directly instead of comparing against `WrapClampWithoutOneLineHints`.

## Question

Does the current one-line hint layer in `WrapClamp` materially improve performance versus the same implementation with that hint layer disabled?

## Method

- Add an internal benchmark-only comparison export:
  - `WrapClamp`
  - `WrapClampWithoutOneLineHints`
- Run the benchmark in the browser through Vitest + Playwright.
- Measure two scenarios:
  - `single-line-width-sweep`
    - `maxLines: 1`
    - 24 badge-like items
    - count-sensitive `before` and `after` slots
    - widths: `[140, 160, 180, 200, 220, 240, 260, 280, 300, 280, 260, 240, 220, 200, 180, 160, 140]`
  - `table-demo-width-sweep`
    - `maxLines: 2`
    - 100 auto-layout table rows
    - widths: `[180, 220, 260, 300, 340, 300, 260, 220, 180]`
- For each scenario:
  - run 1 warmup pair
  - run 5 measured pairs
  - alternate the run order between the two variants to reduce order bias
  - unmount each mounted app immediately after its scenario run
- For every paired run:
  - capture compact rendered snapshots at the initial width and after every measured width change
  - assert that the two variants produce identical final output for every width
- Record medians for:
  - total elapsed time up to the last observed state change
  - mean time per width step up to the last observed state change
  - `getBoundingClientRect()` calls inside the benchmark subtree
  - before-slot invocations
  - item-slot invocations
  - after-slot invocations

## Result

### Single-line width sweep

- Current one-line hints:
  - median total: `129.7ms`
  - median mean step: `8.106ms`
  - median rect reads: `272`
  - median before-slot calls: `52`
  - median item-slot calls: `68`
  - median after-slot calls: `52`
- Without one-line hints:
  - median total: `127.9ms`
  - median mean step: `7.994ms`
  - median rect reads: `176`
  - median before-slot calls: `52`
  - median item-slot calls: `68`
  - median after-slot calls: `52`
- Ratios (`current / withoutHints`):
  - total time: `1.0141`
  - mean step: `1.0141`
  - rect reads: `1.5455`
  - before-slot calls: `1`
  - item-slot calls: `1`
  - after-slot calls: `1`

### Table-demo width sweep

- Current one-line hints:
  - median total: `289.2ms`
  - median mean step: `36.15ms`
  - median rect reads: `17700`
  - median before-slot calls: `0`
  - median item-slot calls: `12600`
  - median after-slot calls: `2800`
- Without one-line hints:
  - median total: `286.5ms`
  - median mean step: `35.813ms`
  - median rect reads: `17700`
  - median before-slot calls: `0`
  - median item-slot calls: `12600`
  - median after-slot calls: `2800`
- Ratios (`current / withoutHints`):
  - total time: `1.0094`
  - mean step: `1.0094`
  - rect reads: `1`
  - before-slot calls: `1`
  - item-slot calls: `1`
  - after-slot calls: `1`

## Interpretation

- In the one-line workload, the current hint layer still does not reduce elapsed time in this corrected benchmark.
- It also does not reduce rerender-like work markers:
  - before-slot calls are identical
  - item-slot calls are identical
  - after-slot calls are identical
- The measurable difference in the one-line case is extra geometry work:
  - about `54.5%` more `getBoundingClientRect()` reads
- In the table workload, all work counters are identical, which matches the design:
  - the one-line hint path is not eligible for `maxLines: 2`
- The corrected harness now also proves output equivalence for every measured width across both variants in these workloads.
- The small timing delta in the table workload is still best treated as noise around the same effective runtime, because the measured work counters are identical.

## Conclusion

- The benchmark does quantify a real behavior difference:
  - the current one-line hint path adds geometry reads
  - it does not show an elapsed-time win in this workload
- The table case confirms the hint layer is isolated to the one-line path and should not explain perceived multiline table drag differences.
