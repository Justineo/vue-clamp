# 1.7.1 release comparison

The 1.7.1 release graphic should describe text-clamping refinements, with four selected
task-time improvements measured directly against 1.7.0 in a separate chart. This is a comparison of the current
working candidate, including the final code simplification, with the `v1.7.0` runtime. It is
separate from research 343's incremental comparison against `97658cf`.

## Baseline and method

The baseline is tag `v1.7.0` (`01512fc`). All 35 baseline source files were checked byte-for-byte
against the tag, including checking for extra files. The retained baseline package from research
341 has identical runtime sources; the intervening TypeScript bridge change did not modify them.
The candidate source and its current production build were frozen before measurement.

The production harness runs twelve instances through twelve updates, with one excluded warmup
and twelve measured rounds. It rotates the candidate, baseline and a duplicate baseline control.
All settled HTML must match exactly across targets and rounds for each performance workload.
No builds, tests or statistical analysis ran alongside the timing. The run contains 360 measured
rows across ten scenarios, using Chromium `151.0.7922.34` and production Vue.

The metric is Chromium CDP `TaskDuration`, including settlement and output capture. It is not
paint time. Reported changes are geometric means of paired candidate/baseline ratios; 95%
intervals use 10,000 paired bootstrap resamples with seed 339. Ratios of the displayed time
medians need not equal the paired change. The duplicate baseline is a drift diagnostic, not a
correction to subtract from the candidate's result. There is no combined library-wide speedup.

Ordinary sources contain 600 UTF-16 units; large sources contain 6,000, with instance-specific
prefixes where labeled distinct. Line and Rich use three lines and a 48px after slot. Typography
is 16px Arial with 24px line height. Resize widths are
`280,260,220,180,250,330,300,190,360,240,320,210`. Source-update cases remain at 300px and change
the source prefix. Inline uses word boundaries and a middle ellipsis. The complete fixture
definitions and raw measurements are retained in the ignored `344-release171.local` evidence.

## Complete measured cohort

Negative changes mean less browser task time. Layout counts and time medians cover the complete
twelve-update sequence. The Line grapheme rows below use the root entry.

| Scenario                                             | Task ms, 1.7.0 → candidate | Paired task change [95% interval] | Duplicate baseline change | Layouts, 1.7.0 → candidate |
| ---------------------------------------------------- | -------------------------: | --------------------------------: | ------------------------: | -------------------------: |
| Line grapheme, resize with after slot                |              38.30 → 34.19 |           −10.16% [−14.33, −5.41] |                    −1.20% |                   123 → 96 |
| Line grapheme, distinct large sources, resize        |              65.77 → 57.33 |           −12.14% [−15.41, −8.89] |                    −2.94% |                  126 → 123 |
| Line grapheme, ordinary source updates               |              40.95 → 32.38 |          −21.55% [−25.37, −17.32] |                    −3.35% |                   120 → 60 |
| Rich plain grapheme, resize with after slot          |              43.61 → 37.58 |           −15.61% [−21.23, −9.04] |                    −2.96% |                  271 → 241 |
| Rich nested grapheme, resize with after slot         |              60.21 → 53.04 |           −11.23% [−12.64, −9.70] |                    −0.38% |                1,172 → 930 |
| Inline, distinct long emoji sources, content updates |            473.57 → 342.39 |          −27.66% [−27.98, −27.32] |                    −0.06% |                   168 → 60 |
| Wrap, ordinary resize                                |              48.13 → 42.69 |            −5.07% [−11.25, +1.39] |                    −2.64% |                    74 → 74 |
| Pretext word-boundary resize control                 |              30.54 → 35.85 |           +12.04% [−0.03, +25.62] |                   +27.15% |                    24 → 24 |
| Line Thai, `overflow-wrap: break-word`               |              76.47 → 92.94 |          +23.01% [+19.88, +26.30] |                    +0.57% |                   95 → 126 |
| Line, negative letter spacing                        |              35.89 → 53.49 |          +44.62% [+38.51, +50.49] |                    +0.87% |                  121 → 180 |

The graphic uses ordinary Line resize (−10.2%), Line content updates (−21.6%), nested Rich
resize (−11.2%) and long-emoji Inline content updates (−27.7%). Each value is rounded directly
from the unrounded paired result. In particular, Line source updates measure −21.5546065%.
The graphic labels these as selected workloads and includes instance count, update count and
browser. It makes no new Pretext prediction speedup claim.

Line content-update layout passes fall from 120 to 60 (−50%) across the complete twelve-update
sequence. All twelve recorded rounds agree, including the duplicate-baseline control at 120.
This is a workload-specific count reduction, not a library-wide result or a 50% task-time gain.
It must not be used as the graphic's dominant headline: small scope labels do not adequately
counteract that visual implication. Lead with the concrete release changes and keep performance
figures in the explicitly scoped workload chart.

Wrap does not establish a stable time improvement in this sample. The word-prediction control
has substantial duplicate-baseline drift and does not establish a timing change. Thai and
negative-spacing correctness fallbacks cost more, even in the wider timing cases where the
final output agrees. These costs remain explicit rather than being combined with favorable
scenarios into an average. Singleton and mount performance are not claimed by this graphic.

## Visible behavior change

A separate real-component comparison verifies this behavior change, which is not shown on the
final graphic:

| Version         | Retained text                |
| --------------- | ---------------------------- |
| 1.7.0           | `Vue Clamp keeps den…`       |
| 1.7.1 candidate | `Vue Clamp keeps dense app…` |

Both components receive the same full source beginning with “Vue Clamp keeps dense application
text readable”, 16px Arial, 22px line height, a three-line limit and a 48px after affix. After
mounting at 84px, both resize to 91px. The reference and candidate source components reproduce
the asserted excerpts in Chromium.

This example records the release's behavior change. Research 343 retains the broader
three-browser grapheme corpus and the boundaries of the refinement's accuracy claims.

## Reproducibility

The frozen JavaScript package fingerprints are:

- 1.7.0: `f1986de36e040a0c744d7999762f59012b641c2299862d73c5258e43f55c0f08`
- Candidate: `3ae2b510ff3c0eb97c532834158f46e8cce7b7f756d45cd0fa663ccfd158fc64`

The complete source identities, raw rows, bootstrap summaries and real-component example are
retained under the ignored `journey/research/344-release171.local/`. Earlier graphic drafts with
a prominent −50% headline are superseded and should not be published unchanged. The final graphic is
`assets/marketing/vue-clamp-1.7.1-v7.png`, with its prompt in the sibling `.prompt.txt` file.
It leads with text-clamping refinements and retains the overlaid horizontal comparison bars,
without truncation examples or a hero performance statistic.
Each workload's baseline bar represents 100%; the candidate bars represent 89.8%, 78.4%, 88.8%
and 72.3% of baseline task time, respectively. Printed percentages remain the authoritative
values for this raster marketing illustration.
