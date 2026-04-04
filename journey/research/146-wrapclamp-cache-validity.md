# WrapClamp cache validity

## Question

Why does the cache-backed variant fail to show a win, and is the benchmark actually measuring the cache?

## Code-path finding

- The cache-assisted shortcut lives in `canSkipGrowthProbe()`.
- That shortcut is disabled unless all of the following hold:
  - cache mode is enabled
  - `maxHeight` is not in use
  - normalized `maxLines === 1`
  - hidden items remain
- The website stress-table demo renders `WrapClamp` with `maxLines: 2`.
- Therefore, the user-visible stress demo never uses the cache shortcut.

## Benchmark validity

### What was wrong with the earlier conclusion

- The earlier table benchmark compared `WrapClamp` against `WrapClampWithGrowthCache` using `maxLines: 2`.
- Because the shortcut was unreachable in that scenario, the benchmark did not measure cache usefulness.
- It only measured the overhead of:
  - font-signature refresh
  - width-cache maintenance
  - `after` width signature maintenance

### What was fixed

- Split the benchmark into two scenarios:
  - `single-line`
  - `table-demo` (`maxLines: 2`)
- Removed an initial no-op width step (`260 -> 260`) that added idle-frame noise.

## Results

- `single-line`
  - render delta ratio: `0.9697`
  - median total ratio: `1.0152`
- `table-demo`
  - render delta ratio: `1`
  - median total ratio: `1.0286`

## Interpretation

- The harness is valid for comparative settled recompute cost:
  - when the cache branch is reachable, it detects fewer rerenders
  - when the branch is unreachable, render counts remain identical
- The harness is not a direct drag-latency benchmark:
  - it applies discrete width steps
  - it waits for each step to settle
  - it does not measure per-frame input responsiveness during continuous slider movement

## Why the cache still loses when active

- The cache only saves a narrow case: skip the speculative `visibleCount + 1` probe when one more item definitely cannot fit on a single line.
- It still pays for:
  - `measureCurrent()` DOM reads
  - visible item width caching
  - `after` width caching
  - font signature refresh
- `canSkipGrowthProbe()` also performs extra geometry work via `measureOccupiedInlineSize(current.boxes)`.
- In the current workload, that bookkeeping costs more than the rerenders it avoids.
