# Preparation, line calibration, and dense-list growth

## Decision

The three prototypes from [research 328](./328-first-principles-optimization-space.md) are now
retained in the components. Integration also retained compact Rich boundaries, deferred full-fit
preparation, lazy measured-word fallback, and a cheaper exact line-box grouping path. Shared
prototype accessors remove an initially observed short-text memory regression.

These changes preserve the existing measured-DOM, slot, source, and synchronous settlement
contracts. They do not add a layout-answer cache or expand the native/predictive eligibility rules.
A font/width co-update check also exposed and fixed an invalid full-fit growth shortcut.

## Retained behavior and ownership

| Area                   | Retained change                                                                                                                               | Boundary of the optimization                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repeated plain sources | Line and Inline share one text/boundary preparation, capped at 8,192 UTF-16 units. Oversized inputs evict the entry.                          | No width, font, marker, affix, DOM, or solved result is shared. Distinct adjacent sources miss.                                                                                    |
| Full-fit plain text    | Source identity and a full-fit result can exist before segmentation; the internal rank resolves when a later overflow needs it.               | Same-width checks still measure current DOM. The existing guarded full-fit-on-grow shortcut remains.                                                                               |
| Measured word text     | Primary cuts are checked against grapheme boundaries; the complete grapheme fallback is built only when consumed.                             | Long-token and extremely narrow cases retain fallback. Rich still prepares both lists when its searchable nodes are needed.                                                        |
| Rich boundaries        | Each leaf stores a path and numeric offsets. Concatenated sequences resolve structural points on demand and locate points with binary search. | Atomic runs, comments, whitespace trimming, path order, and complete-source states retain their existing meaning.                                                                  |
| Full-fit Rich          | Parsed source and rendered support inspection remain immediate; searchable nodes and index data are lazy.                                     | Unsupported source/layout remains a fallback. Typography refreshes share index data without retaining a chain of old indexes.                                                      |
| Line calibration       | A matching last representative and the maximum representative top avoid impossible comparisons.                                               | Unordered or overlapping fragments still use the original half-pixel test. Every positive-height rectangle contributes to calibration.                                             |
| Font delivery          | One native listener per FontFaceSet and one multiline frame delivery allow existing measured jobs to share layout work.                       | Inactive ownership, cancellation, reentrant subscription, error isolation, and conservative font invalidation remain.                                                              |
| Dense Wrap growth      | After the initial frontier fits, no-after materialization extends by 1, 2, 4, 8, … items.                                                     | Every chunk restores direct display mutations before yielding and verifies the current item sequence and before-affix box. Dynamic-after and failed guards retain live settlement. |

Word boundaries remain a subset of grapheme boundaries. Rich therefore uses the fallback sequence
as the combined rank sequence instead of sorting and repeatedly deduplicating point objects.
Primary search behavior is unchanged; rank helpers also reject cuts inside a grapheme or an atomic
box. The new representation is internal to the package.

For plain sources, a forward grapheme iterator validates candidate word endpoints without retaining
the complete fallback array. A safe ASCII range avoids this iteration. Consumers test whether
fallback is needed before reading its lazy property. This ordering matters: a lazy getter alone
did not avoid preparation in the original consumers.

The first candidate used `Intl.Segments.containing()` to query endpoints. Final WebKit comparison
rejected that mechanism: at the leading surrogate of an emoji, the installed engine returned a
segment starting before the boundary produced by iteration. An emoji Inline source consequently
lost a fitting word. Baseline-versus-baseline and the eager-preparation control matched. The
retained iterator follows the same sequence as eager preparation in every engine; there is no
browser-name branch or guessed Unicode exception.

## Production source-update comparison

The baseline is the immutable research 327 package used in research 328. Comparisons load built
ES modules with production Vue, rotate baseline/candidate/duplicate-baseline order, and require
identical settled root markup. The following rows use 20 instances, 12 source replacements per
sample, one warmup and eight measured rounds in Chromium 149.0.7827.55.

Times are medians of native CDP `TaskDuration` deltas in milliseconds. They include benchmark output
capture and browser task activity; they are not isolated component CPU, paint latency, or frame-rate
claims. Intervals are paired bootstrap log-ratio changes, 10,000 resamples. They describe this
process and fixture, not uncertainty across devices, fonts, or application layouts.

| Source-update fixture                            | Baseline | Retained implementation | Duplicate baseline | Paired change, 95% interval |
| ------------------------------------------------ | -------: | ----------------------: | -----------------: | --------------------------: |
| Line, identical 6,000-unit CJK/mixed sources     |   851.58 |                  550.28 |             848.80 |     −35.5% [−35.8%, −35.1%] |
| Line, distinct 6,000-unit CJK/mixed sources      |   966.75 |                  874.84 |             970.94 |        −9.1% [−9.8%, −8.3%] |
| Line, distinct 6,000-unit sources that fully fit |   252.68 |                  200.82 |             252.77 |     −20.6% [−21.5%, −19.8%] |
| Inline, distinct 6,000-unit emoji/mixed sources  |   841.03 |                  843.28 |             841.60 |        +0.5% [−0.1%, +1.1%] |
| Rich, distinct 30,000-unit sources               |  2405.85 |                 1095.16 |            2408.32 |     −54.4% [−54.7%, −54.0%] |
| Rich, distinct 6,000-unit sources that fully fit |   323.40 |                  239.43 |             325.42 |     −25.8% [−27.4%, −24.1%] |

These source comparisons include both the font/width co-update guard and the portable grapheme
iterator. Font delivery is covered separately. Do not add the percentages from isolated experiments
to this combined comparison.

The full-fit long-source rows deliberately have ample line capacity. They demonstrate avoiding
unused preparation, not the usual throughput of short titles. Short-text and ordinary overflow
controls did not establish a general latency improvement.

## Dense Wrap and real font delivery

The final built package also matches the baseline after six successive width changes with 1,000
alternating 3/5 px items, a 48 px height limit, and no after slot. Four rotated rounds gave:

| Instances | Baseline / retained task time | Baseline / retained settled time | Baseline / retained layout time |
| --------- | ----------------------------: | -------------------------------: | ------------------------------: |
| 1         |                 1,646 / 82 ms |                   1,696 / 138 ms |                     201 / 13 ms |
| 4         |                7,457 / 339 ms |                   7,475 / 363 ms |                     976 / 63 ms |

These are deliberately dense growth fixtures. Ordinary 60-item resize controls retained the same
layout counts and did not establish a timing gain. The harness reports ResizeObserver loop
notifications during dense settlement in both versions; its Vite client can contribute reporting
overhead to task time. Native layout duration independently confirms the large reduction. Vue
flush time alone misses most of the baseline's observer-driven growth work.

A separate final comparison loads real local FontFace objects and requires four trusted
FontFaceSet events per sample. Three rotated rounds at 20 instances gave stable layout counts:

| Font-update fixture   | Baseline | Retained implementation | Duplicate baseline |
| --------------------- | -------: | ----------------------: | -----------------: |
| Line                  |      648 |                      40 |                648 |
| Inline                |      528 |                      34 |                528 |
| Rich, inline elements |      888 |                     888 |                888 |
| Rich, plain source    |      648 |                     648 |                648 |
| Wrap, natural items   |      408 |                      28 |                408 |

Single-instance layout counts were unchanged. All settled output matched. Real-font timing had
material duplicate-baseline noise, so the retained claim is fewer layout passes for the eligible
multi-instance paths, not a universal font-load latency improvement. Rich's font invalidation
still performs its support inspection and serial path in these fixtures.

## Why line calibration mattered

An extreme 2 px-wide, 6,000-unit CJK source exposed repeated scans of every preceding line during
line-height calibration. The fit predicate could reject early, but calibration still scanned the
full rectangle list quadratically. This cost existed in the baseline as well as the preparation
prototypes.

The retained path preserves the representative set exactly:

- If the last representative matches both vertical edges within 0.5 px, the rectangle is already
  represented.
- If the next top is more than 0.5 px below the maximum stored representative top, no earlier
  representative can match it.
- Otherwise, use the original comparison against all representatives.

Ordinarily ordered lines become linear work, including adjacent duplicate fragments. The fallback
can still be quadratic for unusual ordering; this is not a global ordering assumption or a new
line-count definition. Maximum height and line-step calibration consume the same rectangles and
representatives as before.

Isolating this change after the preparation work, one instance and four source replacements gave:

| Fixture                               | Previous task time | With line scan |   Paired change, 95% interval |
| ------------------------------------- | -----------------: | -------------: | ----------------------------: |
| 6,000-unit CJK, 2 px width            |          343.83 ms |       39.82 ms |       −88.4% [−88.6%, −88.3%] |
| 30,000-unit Rich source               |           42.30 ms |       20.84 ms |       −50.9% [−55.1%, −47.0%] |
| 6,000-unit CJK, ordinary 300 px width |           21.80 ms |       20.49 ms | No established singleton gain |

Layout counts stayed unchanged. These results concern JavaScript processing of already acquired
layout information. The pathological narrow row is useful for identifying the cost, not a release
headline for ordinary text.

## Retained memory and the short-text correction

Memory experiments compare the mounted JS heap with an unmounted/settled heap after explicit CDP
garbage collection. They measure incremental retained JS bytes, not total browser memory, native
DOM storage, peak allocation, or GC pause time. Identical markup and DOM counters are checked;
rotated duplicate-baseline measurements accompany every comparison.

Isolating compact Rich indexing after the first three changes, five rounds with 20 instances gave:

| Rich source fixture          | Previous retained JS | Compact indexing | Change |
| ---------------------------- | -------------------: | ---------------: | -----: |
| Distinct 30,000-unit sources |             23.30 MB |          3.64 MB | −84.2% |
| Distinct 6,000-unit sources  |              4.72 MB |          1.03 MB | −78.3% |
| Identical 6,000-unit sources |              1.29 MB |          0.45 MB | −65.0% |

This includes the effect of avoiding per-instance flattened boundary arrays, not only fewer source
point objects. Compact indexing alone had a much smaller source-update timing gain, approximately
6% on the long distinct fixture, and mostly neutral ordinary-length timing.

Lazy measured-word fallback reduced incremental retained JS by approximately 43% for distinct
6,000-unit CJK Line sources and 47% for distinct emoji Inline sources. The portable correction still walks
graphemes to validate primary cuts; this optimization avoids retaining unused arrays, not all
segmentation work. The combined source table is the timing claim; the earlier endpoint-query
candidate's small timing gains are not attributed to the retained implementation.

Four follow-up heap rounds comparing endpoint queries with the final iterator found no established
memory change: approximately 0.682 versus 0.680 MB for Line and 0.377 versus 0.378 MB for Inline,
with both paired intervals crossing zero. The portability correction preserves the array-retention
benefit.

The first full-fit implementation allocated getter closures per source and per result. A
200-instance short-title control caught a real memory regression: approximately +5% for Line and
+7% for Inline. Sharing accessors on `DeferredText` and `FullTextResult` prototypes removed it.
Against the per-object-accessor candidate, retained memory fell from 3.01 to 2.85 MB for Line and
1.93 to 1.75 MB for Inline. Source-update timing stayed neutral. Rich was a control because these
classes do not own its representation.

This is why a preparation microbenchmark or a long-source-only result is insufficient: the fixed
cost of deferral also needs a short-source control.

## Lifecycle and correctness constraints

The integration keeps these checks close to the behavior they protect:

- Shared plain preparation: exact source/boundary matching, inclusive size cap, oversized eviction,
  and independently checked Unicode primary/fallback cuts and clamp outputs.
- Deferred source state: each text component can update a fitting source without segmentation,
  then segment and truncate after shrink, and restore full source after growth.
- Rich ranks: every valid point round-trips across nested leaves, comments, atomic elements, a
  line break, combining marks, and emoji; invalid structural and grapheme cuts are rejected.
- Line grouping: overlapping and unordered rectangles retain the original tolerance semantics;
  a long ordered list has a deterministic linear-access budget.
- Font delivery: removal before and during callbacks, ready/frame cancellation, callback errors,
  a new subscriber during notification, and stale cleanup after a new group is created.
- Dense Wrap: an expanded 1,000-item reference establishes the exact visible prefix at successive
  widths; slot-call bounds prevent a return to hundreds of prefix renders.

A separate real-font check changes the glyph face without changing computed font-family CSS while
also growing the container. The old full-fit growth shortcut could keep text that now occupied too
many lines. Font notification now discards a previously full-fit Line result; clamped search hints
remain available. This matters when a font frame is coalesced with a width update. The test enables
long-word wrapping explicitly, since a line limit alone is not a horizontal-overflow constraint.

The fixture loads an available standard monospace face from Courier New, Liberation Mono, or
DejaVu Sans Mono, then signals the controlled font change. Native FontFaceSet event delivery is
measured separately; a dispatched event must not be described as a trusted browser event.

Production comparisons also require exact baseline/candidate markup within Firefox 153 and WebKit
26.5 across nine source, resize, nested/atomic Rich, full-fit, dense Wrap, and no-op scenarios at
one and four instances. WebKit passes after the iterator correction; Firefox's affected source
cases were rerun after that correction. These are correctness checks, not cross-engine performance
comparisons. The browser regression suite includes eager/deferred emoji boundary equivalence so
future engines can exercise the same invariant directly.

## Scope and practical stopping point

The rejected mechanisms and contract-level alternatives in research 328 remain relevant. Paid-width
interpolation, per-glyph Range queries, representative-first cohorts, live computed-style object
reuse, and repeated-candidate verdict reuse did not establish a broad retention case. They are not
made cheaper merely by combining them with these changes.

The retained work removes demonstrated preparation, representation, line-processing, notification,
and dense-prefix costs. Current layout/slot verification remains necessary. Worker rendering,
offscreen deferral, bounded first rendering, native-only entry points, and broader CSS isolation
require separate decisions about freshness, SSR, lifecycle, or supported content. No such contract
change is hidden in this optimization pass.

The evidence establishes a practical stopping point for the examined variants. It does not prove
that no future workload, browser primitive, or representation can improve the package.

The additional representation and lifecycle code has a bundle cost. With Vue externalized,
minified ES modules and gzip level 9, the isolated exports change as follows:

| Export           | Baseline gzip bytes | Retained gzip bytes | Added bytes |
| ---------------- | ------------------: | ------------------: | ----------: |
| LineClamp        |              10,773 |              11,563 |         790 |
| InlineClamp      |               6,171 |               6,742 |         571 |
| RichLineClamp    |              14,848 |              15,180 |         332 |
| WrapClamp        |               5,795 |               5,966 |         171 |
| All root exports |              25,312 |              26,275 |         963 |

The combined increase is approximately 3.8%. These are controlled bundle comparisons, not the
published tarball size or a guarantee about a consuming application's chunking.

## Reproduction and evidence boundaries

[`measure-update-costs.mjs`](../../tools/benchmark/scripts/measure-update-costs.mjs) compares a built
baseline package directory with a candidate directory, defaulting to the workspace package. It
supports source, resize, no-op, and synthetic font-event scenarios, as well as `--heap`. Counts,
rounds, steps and scenario lists use the `VUE_CLAMP_UPDATE_*` environment variables. Results include
browser version, hashes of the built JS files, rotated rows, and exact-output checking. Browser and
executable-path overrides allow compatible installed Firefox/WebKit builds.

For example, a repeatable source/heap comparison uses:

```sh
VUE_CLAMP_UPDATE_SCENARIOS=source-rich-huge-distinct \
  VUE_CLAMP_UPDATE_COUNTS=20 \
  vp exec node tools/benchmark/scripts/measure-update-costs.mjs /path/to/baseline

VUE_CLAMP_UPDATE_SCENARIOS=source-rich-huge-distinct \
  VUE_CLAMP_UPDATE_COUNTS=20 \
  vp exec node tools/benchmark/scripts/measure-update-costs.mjs /path/to/baseline --heap
```

`flushMs` ends after Vue/task flushing and can miss later ResizeObserver work. `settledMs` includes
two deliberate frame waits. Native task metrics include output capture. Dense Wrap must therefore
use settled work and native layout duration rather than the much shorter flush measurement. Large
cohort stress runs are not necessary for every repetition: the 20-instance/1,000-item baseline
required about 31 seconds for twelve updates, so repeated dense comparisons use smaller cohorts.

The original baseline `dist/index.js` SHA-256 is
`fdde6fd3d358db4054d34ae0abd6fa89c1679ca89e78b57326b6b87db770e38d`.
Intermediate package snapshots and raw results are local experiment artifacts under
`/tmp/vue-clamp-optimization-329/` and the runner's printed temporary result directories. The
fixture definitions, ownership rules, comparisons, and trade-offs above are the durable record.
