# WrapClamp cache benchmark

## Question

Does restoring a growth-hint cache materially improve the `WrapClamp` table stress demo once the cache is made resilient to external layout and content changes?

## Method

- Compare two internal strategies:
  - `WrapClamp`: direct live-DOM growth and shrink path
  - `WrapClampWithGrowthCache`: same search model plus conservative single-line growth-hint cache
- Use a browser benchmark instead of a unit-only harness:
  - 200 table rows
  - each row renders a `WrapClamp` with several badge-like labels
  - widths sweep across `[260, 180, 320, 200, 340, 220, 300, 190, 280, 240]`
- Run 6 iterations, discard the first as warmup, and summarize the remaining 5 runs.
- Record:
  - median total width-sweep time
  - median mean step time
  - mean render delta

## Correctness constraints added to the cache path

- Invalidate item-width hints on `items` and `itemKey` changes.
- Invalidate on font-signature changes.
- Track `after` width signatures per hidden-count state.
- Only allow cache-based growth skipping for collapsed single-line probes without `maxHeight`.
- Browser comparison coverage now explicitly exercises:
  - width sweeps
  - keyed item content shrink
  - `itemKey` changes
  - external `after` width/content changes
  - host font changes

## Result

- Direct path:
  - median total: `1208.4ms`
  - median mean step: `120.82ms`
  - mean render delta: `36538`
- Cache-backed path:
  - median total: `1216.7ms`
  - median mean step: `121.66ms`
  - mean render delta: `36538`
- Ratios:
  - total time: `1.0069`
  - render delta: `1`

## Interpretation

- The correctness-hardened cache did not reduce rerenders in this workload.
- It also did not improve elapsed time; it was slightly slower in the current Chromium run.
- That suggests the old perceived smoothness was likely coming from a more aggressive, less defensible cache contract.
- If caching is revisited, it should start from a narrower claim than "general hidden-item growth hints stay valid across external change."
