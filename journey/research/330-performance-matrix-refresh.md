# Performance matrix coverage after preparation and growth optimization

## Scope

The 152-row root matrix preserves the previous 135 workloads and adds 17 public-component
scenarios. This refresh compares published 1.6.0, the immutable pre-research-329 1.7.0 snapshot,
and the current implementation. The intermediate snapshot is not a published release. The
root/Pretext entrypoint matrix remains separate.

The old [56-row report](310-package-benchmark-matrix.md) is historical. Research
[322](322-release-1.6-performance-comparison.md) and
[323](323-line-rendering-regression-audit.md) also measured earlier implementations. None supplies
a current performance figure merely because a column is named `current`.

## Coverage decisions

| Added workload                                                         | Rows | Why it belongs in the public matrix                                                               |
| ---------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------- |
| Shared and distinct 6,000-unit Line / Inline / Rich source replacement |    6 | Separates adjacent source reuse from independent content; includes CJK and emoji word boundaries. |
| Full-fit long Line / Rich source replacement                           |    2 | Exercises work that is unnecessary when the complete content remains visible.                     |
| Short full-fit replacement for all three text components               |    3 | Keeps fixed preparation costs visible next to long-content wins.                                  |
| Distinct 30,000-unit Rich source replacement                           |    1 | Covers large rich content and line calibration without using the pathological 2 px diagnostic.    |
| Dense 1,000-marker Wrap growth and shrink                              |    1 | Exercises materialization well beyond the existing 120-item / 16 px fixture.                      |
| Real font loading for all four components                              |    4 | Measures trusted browser notifications; existing synthetic font scenarios retain their meaning.   |

Text rows contain 16 instances and six source changes at a fixed width. The dense Wrap row has
four instances and six width transitions. Both use public components from built packages.
Source and list checks run after timing and counter collection, ensuring the final revision is
displayed, full-fit rows really fit, and dense lists retain an ordered visible prefix within the
height limit. An expanded Wrap reference establishes the final maximal prefix from browser
geometry. Dedicated browser correctness tests still own exhaustive multi-step cut checking.

Real-font rows alternate available local monospace and sans-serif faces. Each sample requires six
trusted `loadingdone` events for the specific loaded faces, exposes the event count in the report,
and removes the faces after unmounting. Local font loading time is part of the active interval;
these rows do not isolate component CPU or claim that a native event is equivalent to a dispatched
test event.

The focused scenario list and normal commands live in
[`tools/benchmark/README.md`](../../tools/benchmark/README.md). Retained JS heap remains a separate
`benchmark#updates --heap` experiment. Putting heap numbers into a timing-only matrix would obscure
its measurement boundary.

## Measurement boundary

The full screen uses production Vue, one warmup, three measured rounds, and alternating target
order in a single Chromium process. Structural counters are disabled for timing. Active time
includes activity through DOM and ResizeObserver settlement, rather than only the first Vue flush;
settled time also includes the quiet-frame wait. It is not native task CPU, paint time, or FPS.

Summed scenario medians are workload-weighted screening totals. The original 135 rows and added
17 rows are summarized separately: dense-list stress must not dominate the ordinary-workload
comparison. Individual paired intervals and targeted repeats distinguish a possible regression
from sampling noise. A three-sample screen alone cannot establish equivalence or exclude small
regressions. Separate counters explain changed browser work without conflating instrumentation
overhead with production timing.

## Results

The [complete matrix](330-performance-matrix.md) and
[SVG view](330-performance-matrix.svg) retain every row. All 152 scenarios ran successfully for
all three targets. The following values sum the active-time median of each scenario; they are
screening totals in milliseconds, not isolated component CPU or a general application speedup.

### Original 135 rows

| Component | Rows | Published 1.6.0 | Before research 329 | Current | Cumulative vs 1.6.0 | This iteration |
| --------- | ---: | --------------: | ------------------: | ------: | ------------------: | -------------: |
| Line      |   45 |         5,316.1 |             4,849.8 | 4,876.5 |               −8.3% |          +0.6% |
| Inline    |   17 |         1,587.0 |             1,181.0 | 1,183.0 |              −25.5% |          +0.2% |
| Rich      |   46 |         6,121.4 |             6,050.1 | 5,999.4 |               −2.0% |          −0.8% |
| Wrap      |   27 |         3,067.3 |             2,231.7 | 2,220.3 |              −27.6% |          −0.5% |

This iteration is effectively flat in the original workload mix; its sub-1% aggregate changes do
not establish a general resize improvement or regression. The cumulative comparison contains
earlier 1.7.0 work, especially measurement batching, and must not be attributed entirely to the
eight changes in research 329. Small cumulative differences such as Rich's 2% also need to be
read with individual row uncertainty.

### Added 17 rows

| Component | Rows | Published 1.6.0 | Before research 329 | Current | This iteration |
| --------- | ---: | --------------: | ------------------: | ------: | -------------: |
| Line      |    5 |           641.7 |               546.0 |   432.0 |         −20.9% |
| Inline    |    4 |           503.3 |               487.7 |   453.4 |          −7.0% |
| Rich      |    6 |         1,262.8 |             1,270.3 |   688.4 |         −45.8% |
| Wrap      |    2 |         4,412.8 |             5,058.8 |   357.4 |         −92.9% |

The large Wrap aggregate comes almost entirely from the dense marker fixture. It is not an
ordinary-list speedup. Representative per-row medians before/current are 208.0/132.2 ms for
identical long CJK Line updates, 203.6/184.2 ms for distinct Line updates, 868.3/369.2 ms for
30,000-unit Rich updates, and 5,032.9/331.8 ms for dense Wrap growth. The distinct long emoji
Inline row remains neutral at 226.0/226.8 ms; its retention case is memory rather than latency.

### Screening and repeats

The initial paired screen classified 55 rows lower and 97 inconclusive against 1.6.0, with no
higher interval. Against the immediate pre-329 snapshot, it classified 19 lower, four higher,
and 129 inconclusive. These counts are unadjusted screening results over many comparisons,
not a proof that all regressions have been excluded.

All four higher signals were repeated with seven measured rounds, one warmup, and a duplicate
baseline in the same process. None reproduced a positive paired interval:

| Repeated scenario                              | Initial mean increase | Repeat mean difference | Repeat paired 95% interval |
| ---------------------------------------------- | --------------------: | ---------------------: | -------------------------: |
| Inline end, width jumps                        |              +2.70 ms |               +0.06 ms |          [−1.19, +1.30] ms |
| Line long token, after-affix resize            |              +2.57 ms |               +0.01 ms |          [−3.46, +3.49] ms |
| Inline distinct long emoji updates             |              +1.23 ms |               −1.20 ms |          [−3.75, +1.35] ms |
| Line full-fit synthetic used-font notification |              +0.17 ms |               −0.03 ms |          [−0.16, +0.10] ms |

Duplicate-baseline intervals also span zero in all four rows. The repeat supports treating these
initial red cells as unconfirmed, while leaving small effects unresolved.

Six large but inconclusive median increases against 1.6.0 were also repeated with seven measured
rounds and one warmup, alternating 1.6.0/current. None established a higher paired interval:

| Scenario                       | Repeat mean difference |  Paired 95% interval |
| ------------------------------ | ---------------------: | -------------------: |
| Rich short full-fit updates    |               +2.31 ms |    [−5.34, +9.97] ms |
| Line prefixed summary, jumps   |               −0.79 ms |    [−6.47, +4.90] ms |
| Line word copy, jitter         |              −66.06 ms | [−106.10, −26.01] ms |
| Rich inline markup, continuous |               −0.07 ms |  [−18.00, +17.86] ms |
| Rich word copy, five lines     |               +2.04 ms |    [−4.37, +8.45] ms |
| Rich dynamic atomic layout     |               +8.67 ms |   [−1.16, +18.51] ms |

The Line jitter row is particularly sensitive to sampling: its initial median was 50% higher,
with 95% active-time RME on the old version, while the repeat's paired mean is 13.8% lower.
This is why absolute heatmap colors and three-sample medians are screening signals. The remaining
intervals leave possible small or scenario-specific costs unresolved.

## Structural evidence and trade-offs

A separate two-sample counters-on pass covers the added 17 rows and the three original rows
flagged by screening. Text and font fixtures keep the same geometry-read and mutation counts
against the pre-329 snapshot. That does not contradict faster preparation or fewer forced layout
passes: counting a read does not measure its JavaScript preparation cost or whether it forces a
fresh layout. Native CDP layout and heap evidence remains in
[research 329](329-preparation-and-growth-optimization.md).

Dense Wrap shows a deliberate trade-off:

| Six growth/shrink updates over four lists | Before research 329 | Current |
| ----------------------------------------- | ------------------: | ------: |
| Bounding-box reads                        |           2,836,664 | 187,720 |
| Item-slot calls                           |           2,838,244 |  54,744 |
| Mutation records                          |              14,296 |  46,928 |

Larger frontier chunks cause more item visibility writes, but eliminate repeated rendering and
measurement of nearly the same prefixes. The reduced total active time is supported by the much
smaller slot/read counts, despite increased mutations. A rule requiring every structural counter
to decrease would reject this useful trade-off.

All four native-font fixtures report exactly six trusted events per sample for both versions.
All four timing-repeat fixtures keep their inspected structural counts unchanged. The expanded
Wrap geometry oracle also passes for 1.6.0, the pre-329 snapshot, and current.

## Reproduction

The screening command was:

```sh
VUE_CLAMP_BENCH_COUNTERS=0 VUE_CLAMP_BENCH_MODE=smoke \
  VUE_CLAMP_BENCH_MIN_RUNS=3 VUE_CLAMP_BENCH_MAX_RUNS=3 VUE_CLAMP_BENCH_WARMUP_RUNS=1 \
  vp run benchmark#package -- --targets vue-clamp@1.6.0,/path/to/pre-329,current
```

Focused repeats use seven samples and two copies of the baseline target alongside current.
Counters run separately with the checked-in scenario list. Raw logs and parsed reports are local
artifacts under `/tmp/vue-clamp-matrix-330/`; generated per-sample report data has the ignored
`.local.json` suffix.

The built-package fingerprints, hashing sorted JS filenames and contents, are
`6e6b4ae9d9ac217265419ced6689168302941115e052208987f1dc84802781a0` before research 329 and
`7b469ec41718f04db1c64021db1725fdfb5526a08adb5f8b51e171803890aa53` for current. The current package
matches the final portable implementation from research 329. The full matrix validates that
implementation against broader workloads; adding rows is coverage work, not another runtime
optimization.

The browser was Chromium 149.0.7827.55 at 1280 by 900. The SVG caption describes selected targets
and snapshots explicitly; it no longer implies that every published version was measured.
