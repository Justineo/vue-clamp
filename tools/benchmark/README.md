# Public performance matrix

Run the built-package matrix with production Vue:

```sh
vp run benchmark#package -- current
vp run benchmark#package -- --targets vue-clamp@1.6.0,current
```

The default root matrix has 152 rows: 50 Line, 21 Inline, 52 Rich, and 29 Wrap.
Its original 135 rows retain their fixtures and names. The 17 additions cover:

- Identical and distinct 6,000-unit source updates for Line, Inline, and Rich.
- Fully fitting long Line/Rich content and short fitting controls for all three text components.
- Distinct 30,000-unit Rich content.
- Four dense Wrap lists with 1,000 alternating 3/5 px markers and a 48 px height limit.
- Six real, trusted FontFaceSet load events per run for each component family.

The text additions use 16 instances and six source changes at a fixed width. Final content is
validated after timing and counter collection. Font rows alternate available local monospace and
sans-serif faces; they require Courier New/Liberation Mono/DejaVu Sans Mono and
Arial/Liberation Sans/DejaVu Sans. Missing fonts fail the run instead of substituting a synthetic
event. Existing `font-tick` and `used-fontface` rows retain their synthetic-event semantics.

Run just the added rows through the checked-in scenario list:

```sh
VUE_CLAMP_BENCH_SCENARIOS_FILE=tools/benchmark/scenarios/preparation-and-growth.txt \
  vp run benchmark#package -- --targets /path/to/baseline,current
```

Use `VUE_CLAMP_BENCH_COUNTERS=0` for timing comparisons. Run counters separately to explain changes
in geometry reads, DOM work, slot calls, or trusted font events. Targets alternate order within
the same process. `BENCH_PAIRED_COMPARISON` reports paired timing intervals; a short smoke run
checks execution and fixture assertions, not precise performance. Repeat consequential uncertain
rows with more samples and an identical-code control.

`active ms` includes work through observed DOM/ResizeObserver activity; `settled ms` also includes
the quiet-frame wait. Neither is isolated CPU time or paint latency. Report the original rows and
the added stress rows separately when comparing aggregate medians: a dense-list stress case must
not dominate a claim about ordinary resize performance.

## Native task metrics and retained memory

The matrix does not measure retained JS heap. The complementary update runner supports source,
resize, no-op, item-size, and synthetic font-event workloads:

```sh
VUE_CLAMP_UPDATE_SCENARIOS=source-rich-huge-distinct VUE_CLAMP_UPDATE_COUNTS=20 \
  vp run benchmark#updates -- /path/to/baseline

VUE_CLAMP_UPDATE_SCENARIOS=source-rich-huge-distinct VUE_CLAMP_UPDATE_COUNTS=20 \
  vp run benchmark#updates -- /path/to/baseline --heap
```

The optional second positional argument selects a built candidate package; otherwise the runner
uses the workspace package's existing build. It records exact settled markup comparisons,
duplicate-baseline controls, browser version, and package fingerprints. Chromium supplies native
task/layout counters and forced-GC heap measurements. Heap deltas are incremental retained JS,
excluding native DOM memory; task deltas include output capture. Firefox/WebKit overrides provide
within-engine output checks. Synthetic font events in this runner are distinct from the matrix's
native font-load rows.
