# Further performance exploration after research 329

> Subsequent decision: the dedicated Han/punctuation shortcut described below was removed. The
> small ASCII fast path remains because numeric bounds suffice without a Unicode lookup table;
> other text uses `Intl.Segmenter`. Preparation pooling, Wrap growth probing and warm Rich batching
> remain. Timings below describe the historical combination, not the retained implementation.

## Decision

The baseline for this investigation was `d826aa59130bb154ac292defcd66f00f3efa6722`. The archived
prototypes cover known one-unit graphemes, a small shared preparation pool, the upper endpoint of
a geometric Wrap continuation, and warm Rich remeasurement for one-text-node sources. These four
routes were subsequently integrated in [research 333](./333-preparation-and-warm-measurement.md),
which also resolves the heap observation below. This document preserves the original exploration
and prototype measurements.

The exploration prioritized the one-unit grapheme and Wrap changes: their evidence is strongest and they introduce
no persistent ownership. The pool is useful when a cohort repeats a few sources; it needs a workload
justification. Rich batching has a useful but narrow eligible surface and a synchronous settlement
constraint. Its small retained-heap increase should be understood before integration. Two additional
leads remain conditional: high-limit line grouping and CSS Typed OM width eligibility.

## Cost model and coverage

The investigation covered preparation, DOM measurement, candidate ordering, batching, hidden-text
layout, cache locality, retained heap, initial mount, and teardown. Source, resize, font, full-fit,
short-text, distinct/shared cohorts, dense Wrap and mixed/atomic Rich cases are separate workloads.

A diagnostic 500 µs CPU profile of the current built package still found substantial grapheme
validation in long distinct CJK source changes. Native rectangle measurement dominated much of the
remaining Line, Inline and Rich work. Dense Wrap continued to pay for item measurement, display
patching and Vue slot materialization. These sampled stacks identify candidates; they do not establish
precise component CPU percentages. No-op/short-text controls are often close to the harness floor.

Initial mount remains a separate opportunity. Three-round baseline diagnostics at 200 instances
recorded 61.9 / 31.5 / 299.0 ms native task medians for ordinary 600-unit Line / Inline / Rich sources;
Rich layout accounted for 247.9 ms and 3,401 layout flushes. Short fully fitting Rich sources took
62.2 ms with 401 flushes. Wrap with 60 items took 189.7 ms, of which 37.2 ms was layout. Teardown
medians were 1.0–4.0 ms. These measurements include mount, settlement and output capture. They are
baseline diagnostics, not evidence that the warm Rich prototype accelerates initial rendering.

The attempt to batch cold Rich sources illustrates why this distinction matters: reducing layout
count alone made that experiment slower and changed immediate slot state.

## Four retained prototype routes

### Known one-unit graphemes

The existing ASCII shortcut can include BMP Han `U+3400–U+4DBF`, `U+4E00–U+9FFF`, and the punctuation
`U+3001`, `U+3002`, `U+FF0C`. The entire source must belong to the admitted set. Word boundaries still
come from `Intl.Segmenter`; this avoids the redundant grapheme pass needed to validate word cuts.
Eager preparation also builds direct numeric grapheme offsets for admitted sources.

This is a closed-set rule, not an assumption that arbitrary Chinese text has one-unit graphemes.
Emoji, variation selectors, combining marks, astral Han, Hangul and CRLF take the existing iterator.
All 27,684 admitted characters were checked against Unicode 17 grapheme-break properties: 27,682
are `Other`, one is `Control`, and one is `LF`. No joining rule applies inside the admitted alphabet.
See [Unicode grapheme rules](https://www.unicode.org/reports/tr29/) and the
[Unicode 17 property data](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakProperty.txt).

The complete alphabet plus 500 seeded mixed safe/unsafe strings and explicit edge cases produced
512 sources. Eager/deferred preparation with word/grapheme boundaries matched the baseline in
2,048 comparisons **per engine** on Chromium 149.0.7827.55, Firefox 153.0 and WebKit 26.5. No
`Segments.containing()` shortcut is reintroduced.

The isolated four-round screen reduced distinct 6,000-unit CJK Line work by 9.2% and CJK Rich work
by 7.8%. Latin and emoji controls did not establish a gain. Before production integration, rename
prototype `asciiSafe` locals and update their comments to describe the expanded admitted set.

### Small shared preparation pool

Replace the single adjacent preparation with an MRU array of at most four exact text/boundary
entries. The **combined source budget stays at 8,192 UTF-16 units**; it is not multiplied by four.
Oversized input clears the pool. Eviction removes the oldest entry until both bounds are satisfied.
Only pure preparation is shared; DOM, measured answers, typography and search hints remain local.

At 20 instances, repeating two or four 1,500-unit CJK sources reduced isolated source-update work
by roughly 15–16%. Four emoji/mixed sources improved Inline by about 5%. Eight interleaved sources,
two 6,000-unit sources that exceed the combined budget, and distinct-source controls did not gain.
A bounded pool adds lookup/metadata costs and depends on reuse; it is not a general distinct-text win.

### Probe the upper endpoint of a geometric Wrap continuation

After the existing no-after frontier has already fitted and growth adds more than one item, test
whether the whole new materialized chunk fits. If it does, use its endpoint immediately. Otherwise
run the original binary search below that failed endpoint. The first frontier keeps its old ordering.

This removes needless midpoint probes in chunks that mostly fit. It keeps live slot rendering,
item-sequence verification, before-affix guards, display restoration before yielding, and current
DOM measurement. It adds no retained layout answer. The isolated four-round screen improved the
1,000-item width-jump fixture by 21.4% with `maxHeight` and 14.9% with `maxLines`.

### Warm Rich batching for one text node

Allow full-candidate probing in the text batch only when the previous state is clamped and the
prepared source contains one text node. Null and previously full states stay serial. Existing
nonempty-ellipsis, explicit-width, current-state and affix restrictions still apply. Markup-bearing
sources retain the earlier narrower same-leaf eligibility.

A batched full-candidate read must reset cached visible bounds. More subtly, the measured result
must patch visible DOM and start status settlement inside the measurement completion callback.
Wrapping that helper in an extra `async` function changed microtask ordering: the after slot's
`clamped` value was stale immediately after `nextTick`. The retained helper returns the existing
settlement promise directly. Alternating long/fully-fitting source and slot-payload checks now match.

This accelerates plain text supplied through the Rich HTML API, not arbitrary styled inline HTML.
Four-round native font loads at 20 instances and four font events per sample reduced task time
from 33.47 to 28.34 ms without an affix (paired −17.6%, interval −26.5% to −12.4%), and 32.52 to
29.63 ms with an affix (−12.7%, −16.3% to −8.9%). Every sample observed four trusted font events and
matched settled markup. Styled Rich controls did not establish a gain.

## Combined production-build comparison

The four-route candidate uses production Vue and built ES modules. Every update compares settled
root markup against the baseline and a duplicate baseline. Target order rotates; there is one warmup
and eight measured rounds. Rows below use 20 instances and 12 updates, except Wrap uses four
instances. The candidate adds no public API.

Times are native Chromium CDP `TaskDuration` medians, including browser task work and harness
output capture. They are not isolated CPU, paint latency or frame-rate measurements. Changes and
95% intervals use paired log ratios with 10,000 bootstrap resamples. This describes the local process
and fixtures, not variation across devices, fonts or application CSS. Isolated gains must not be added.

| Fixture                                              | Baseline ms | Candidate ms | Paired change, 95% interval |
| ---------------------------------------------------- | ----------: | -----------: | --------------------------: |
| Line, distinct 6,000-unit CJK sources                |      919.56 |       841.52 |        −8.6% [−9.2%, −8.1%] |
| Line, four repeated 1,500-unit CJK sources           |      301.11 |       247.00 |     −18.1% [−18.8%, −17.4%] |
| Inline, four repeated 1,500-unit emoji/mixed sources |      269.62 |       256.68 |        −5.1% [−5.6%, −4.5%] |
| Rich, distinct 6,000-unit CJK sources                |    1,038.17 |       949.96 |        −8.3% [−9.0%, −7.5%] |
| Rich, one text node, synthetic font-metric change    |       79.95 |        71.39 |      −12.9% [−17.3%, −8.4%] |
| Rich, one text node, width changes                   |       58.04 |        51.47 |      −10.7% [−13.7%, −7.7%] |
| Wrap, 1,000 small items, height-limited width jumps  |      646.80 |       514.22 |     −20.3% [−20.8%, −20.0%] |

The first combined emoji/distinct Inline run suggested a small regression: 859.89 → 868.93 ms,
paired +0.90% [0.37%, 1.34%], mostly native layout time. An independent 12-round repeat gave
857.66 → 856.96 ms, −0.05% [−0.60%, +0.49%], with duplicate-baseline −0.38% [−0.89%, +0.07%].
The regression was not reproduced. Short Line controls remain noisy and do not establish a win.

## Memory, compatibility and size

Forced-GC heap measurements follow six updates, so they exercise warm caches rather than only
mount state. Four rotated rounds at 20 instances measured incremental retained JavaScript heap
relative to an empty mount. Native DOM allocation is excluded; node/document/listener counters
matched each corresponding target.

| Fixture                                | Baseline bytes | Candidate bytes | Interpretation                                                    |
| -------------------------------------- | -------------: | --------------: | ----------------------------------------------------------------- |
| Four 1,500-unit CJK Line sources       |        495,698 |         383,022 | Sharing reduces duplicated live preparation                       |
| Distinct 6,000-unit CJK Line sources   |        931,764 |         928,556 | No established difference                                         |
| Distinct 6,000-unit plain Rich sources |      1,076,348 |       1,100,606 | +24,258 bytes / 20 instances; investigate before integrating Rich |
| Four short Line sources                |        320,282 |         323,964 | Difference within local noise                                     |

The Rich increase is paired +2.4% [1.7%, 3.1%]; it is not evidence of an unbounded leak, and the
experiment does not identify its exact ownership. Do not hide this cost behind the pool's separate
memory benefit.

The combined candidate passes 87 unit and 339 browser tests. Nine production scenarios at one
and four instances also matched baseline markup in Firefox and WebKit, including CJK, emoji,
font changes, plain Rich affixes, nested atomic Rich, full-fit sources and dense Wrap. These are
cross-engine behavior checks, not cross-engine performance claims. Immediate `nextTick` slot
payload checks are separate from eventual settled-output comparisons.

The full public matrix completed all 152 scenarios for both packages: 304 successful scenario/target
results, two samples and one warmup each, counters disabled. This is an execution and regression
screen. One Line word/height row initially suggested +13.6% active work. A 12-round repeat with a
duplicate baseline did not confirm that regression: paired mean change was −3.5%, while the duplicate
baseline changed −10.8%; both paired difference intervals included zero. No precise broad speedup
should be inferred from these noisy matrix samples.

Consumer bundles externalize Vue, minify with esbuild through the installed Vite, and gzip at level 9. These are export-specific root bundles, excluding Vue, declarations and maps:

| Import           | Baseline gzip bytes | Candidate gzip bytes | Increment |
| ---------------- | ------------------: | -------------------: | --------: |
| LineClamp        |              11,563 |               11,768 |      +205 |
| InlineClamp      |               6,742 |                6,926 |      +184 |
| RichLineClamp    |              15,180 |               15,324 |      +144 |
| WrapClamp        |               5,966 |                5,995 |       +29 |
| All root exports |              26,275 |               26,618 |      +343 |

Standalone all-export gzip increments were +93 bytes for the alphabet, +131 for the pool, +27 for
Wrap and +114 for warm Rich. Bundling/compression interactions mean these increments do not sum
to the combined result.

## Rejected and conditional routes

| Route                                                       | Evidence                                                                                                | Disposition                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Batch cold/full Rich one-text sources                       | Layout count 1,692 → 360, but task 292 → 347 ms; alternating sources exposed stale immediate slot state | Reject broad cold eligibility; retain only guarded warm path                |
| Snapshot Wrap children once per atomic search               | Roughly 2% gain in the dense case                                                                       | Too small to justify its extra measurement API alone                        |
| Zero font size/line height on hidden accessible source      | No established task gain; three small AX-name comparisons matched                                       | Discard; no reason to change hidden-text styling                            |
| Strict containment on that hidden source                    | No established task gain                                                                                | Discard                                                                     |
| Extend exact line-group scan shortcut to remaining fit loop | One instance, 6,000-unit CJK, 500-line / 20,000 px caps and 2 px width: 118.7 → 92.2 ms, paired −21.8%  | Conditional high-limit opportunity; not in combined candidate or full suite |
| Allow computed CSS pixel widths through Typed OM            | Class/custom-property width fixture: Line source −17.6%, resize −16.1%; Inline −10.9% / −8.6%           | Promising but unproven eligibility; not in combined candidate               |

The line-group shortcut preserves the existing half-pixel comparison and falls back for unordered
or overlapping fragments. Its measured opportunity needs unusually high line limits combined with
a height cap; ordinary controls were inconclusive.

The Typed OM prototype only admits finite positive pixel values from `computedStyleMap()` after
the current inline-style guard fails. The measured class-based fixture is insufficient to prove
content independence under min/max sizing, flex layout, ancestor selectors or CSS changes. Browser
availability/fallback behavior also needs verification. Do not extend batching eligibility merely
because a computed value says `px`. The prototype remains archived for a separate CSS-context study.

Offscreen work, workers, bounded initial materialization and a native-only API remain contract-level
options already discussed in research 328. This round found no new evidence that would justify
changing freshness, accessibility, slot or DOM authority to obtain their potential savings.

## Reproduction and retained evidence

[Prototype instructions](./332-prototypes/README.md) identify independent patches, fixture changes
and commands. [Measurement samples](./332-prototypes/measurements.json) preserve paired native
metrics and heap observations, with build fingerprints. The baseline built-JS fingerprint is
`7b469ec41718f04db1c64021db1725fdfb5526a08adb5f8b51e171803890aa53`; the formatted combined candidate is
`7eaf8543b08804396411ddd1298fb02ea03e2d3023da4143923fc7b3754cfbe1`. These hash sorted JS filenames and
contents, excluding declarations and source maps.

The patches are evidence for a future integration, not an instruction to apply every route. Preserve
the narrow gates, add focused regression coverage for each new invariant, and recheck the held-out
controls when integrating. The practical next step is a small grapheme/Wrap change followed by
separately justified pool and warm Rich work.
