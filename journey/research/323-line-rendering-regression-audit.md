# LineClamp rendering regression audit

## What the release screen established

Research 322's +6.5% aggregate and +18% individual active-time medians were screening
signals. They did not establish the size or cause of a runtime regression. Comparing
separate medians from a few noisy runs does not use the paired sampling order or quantify
uncertainty in the difference itself.

An eight-round repeat of the original public fixture included the published 1.6.0,
an immutable pre-fix 1.7.0 build, and a second label importing exactly the same 1.7.0
module. Two warmup rounds preceded measurement. All targets used production Vue 3.5.38.

| Scenario                     | 1.6.0 median | Pre-fix median | Identical-code control median | Paired mean difference, pre-fix minus release | Approximate 95% interval |
| ---------------------------- | -----------: | -------------: | ----------------------------: | --------------------------------------------: | -----------------------: |
| CTA affix, continuous        |    423.75 ms |      442.10 ms |                     448.65 ms |                                     +39.77 ms |     -32.65 to +112.20 ms |
| Word copy, five lines, steps |     46.65 ms |       51.05 ms |                      45.30 ms |                                      +2.06 ms |        -0.50 to +4.63 ms |

The identical-code fit controls differed by 12.7% when using the faster median as the
base. Both release-comparison intervals include zero. These data do not support
attributing a 3–18% slowdown to the implementation, nor do they prove equivalence.
No particular OS scheduling, CPU frequency, or GC mechanism is claimed as the cause
of the timing variation without further evidence.

## Confirmed extra rendering work

The predictive integration changed the inner text span from a direct string child to
an array containing a string. Vue normalizes that array item into a Text VNode on
every render and enters the child-diff path even when the visible text and span
attributes did not change. Browser read and mutation totals do not count this work.

Keeping a text VNode has a benefit: Vue can preserve the DOM text node when the visible
prefix changes instead of replacing it. Simply restoring direct string children was
therefore an incomplete fix. A hybrid that switched representation at the full/clamped
boundary reduced VNode creation but increased DOM mutations: 12,139 to 12,155 in the CTA
row, 11,536 to 11,664 in word jitter, and 822 to 870 during font recovery. It was rejected.

Replacing the shared shell's WeakMap with fixed snapshot fields did not show a repeatable
benefit in the isolated production comparisons and was also rejected.

The retained change uses Vue's `withMemo` only for the internal visible-text span. Its
complete inputs are the rendered text, accessible-source visibility, native mode, and
pending-prediction visibility. A matching update reuses that VNode; a changed input
renders and patches normally. The body, root, consumer slots, layout checks, and solver
remain active. The cache holds one leaf per component and retains the existing text-node
representation across full, clamped, native, and predictive states.

## Allocation evidence

A temporary copy of the verified production Vue runtime counted VNode construction,
text patch processing, and keyed-child diff entry. These counters were not included in
elapsed-time samples or shipped runtime code. Every target's visible output matched
after every width step. Each workload used 16 mounted instances.

| Workload                              | Pre-fix VNodes | Retained VNodes | Change | Text VNodes before / after | Keyed diff entries before / after |
| ------------------------------------- | -------------: | --------------: | -----: | -------------------------: | --------------------------------: |
| CTA affix, 140 width steps            |         19,756 |          16,876 | -14.6% |                2,272 / 832 |                   11,500 / 10,060 |
| Word copy, 120 jitter steps           |         14,440 |          11,208 | -22.4% |                2,160 / 544 |                     8,760 / 7,144 |
| Full text, 28 effective width changes |          2,716 |           1,820 | -33.0% |                    448 / 0 |                     1,820 / 1,372 |

The full-text release baseline created 2,268 VNodes. The retained version also avoids
recreating the unchanged inner span, so its count is lower than 1.6.0's direct-string
implementation. Allocation reductions are not equivalent elapsed-time percentages.

## Measurement safeguards

Public multi-target benchmarks now report paired-round mean differences and approximate
95% Student-t intervals for active time, Vue update time, and ResizeObserver callback
time. An interval crossing zero is explicitly inconclusive. These are diagnostic
intervals, not an equivalence test or a multiple-comparison-corrected release gate.
Existing structural counter checks remain separate.

A duplicate target provides an A/A control without a new public component fixture:
`vp run benchmark#package --targets vue-clamp@1.6.0,current,current`. Pair records include
indices and whether the entries match, so duplicate labels are distinguishable.

An isolated Vite development server can prebundle development Vue despite a source-level
production define. That affected an initial diagnostic and its timings were discarded;
the original Vitest package benchmark was verified to use production Vue. A permanent
package-benchmark runtime check now verifies that development-only prop validation is
absent. Production diagnostics also validate the runtime before sampling.

## Timing and browser-work limits

A counters-off production comparison ran the same full-text width sequence with 256
instances and four cycles: 112 effective width changes, or 28,672 component updates per
sample. Targets rotated order each round; the first round was discarded and eight were
measured. Vue update-flush timing excludes deliberate frame waits. The original browser
node-output checks still matched across every target and width.

| Target                    | Median update flush | Mean update flush |
| ------------------------- | ------------------: | ----------------: |
| Published 1.6.0           |            631.8 ms |          646.3 ms |
| Pre-fix 1.7.0             |            643.1 ms |          650.0 ms |
| Identical pre-fix control |            633.8 ms |          644.1 ms |
| Retained memo             |            621.2 ms |          640.2 ms |

The paired mean memo-minus-pre-fix difference was -9.74 ms (-1.5%), with an approximate
95% interval of -34.79 to +15.32 ms. Against 1.6.0, it was -6.04 ms, with an interval of
-37.49 to +25.41 ms. Neither establishes a precise elapsed-time gain. The defensible
improvement is the removal of repeated VNode work, not a claim that every resize is
3–18% faster.

A separate production CPU sampling pass used three rounds of that same dense fixture
at a 100-microsecond interval. Summed inclusive samples in Line's `render` fell from
287.9 to 280.2 ms, and Vue's `flushJobs` stack from 1,958.1 to 1,890.4 ms. These overlapping
profile scopes must not be added together or substituted for the uninstrumented timing
interval. They localize work; allocation counts establish exactly what was removed.

All 45 public Line scenarios preserved bounding-box/client-rect/scroll/style reads,
DOM mutation subtypes, node additions/removals, and before/after slot calls. Unlike the
rejected representation-switching variant, the memo keeps DOM text-node behavior intact.
Two Pretext CSS transition controls also retained zero geometry and style reads. Browser
coverage includes unchanged-text root-tag replacements, full/clamped transitions, native
and predictive mode changes, text updates, fonts, and state-dependent affixes.

## Delivery cost

Production-minified isolated consumers with Vue external and gzip level 9:

| Import             | Pre-fix gzip | Retained gzip | Change |
| ------------------ | -----------: | ------------: | -----: |
| Standard LineClamp |      9,580 B |       9,622 B |  +42 B |
| Pretext LineClamp  |     29,371 B |      29,416 B |  +45 B |

RichLineClamp, InlineClamp, and WrapClamp consumer sizes are unchanged. The retained
standard LineClamp is 529 B gzip larger than published 1.6.0, including the earlier
predictive integration hook, not just this fix.
