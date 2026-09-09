# Cold preparation and split search

## Retained decisions

InlineClamp extends its cold width-ratio hint to split bodies. After the full candidate overflows,
one body bounding-box read separates body width from fixed affix occupancy. The ratio only seeds
the existing measured search; it cannot authorize a result. Empty or zero-width bodies seed zero,
and the existing greater-than-16-boundaries gate remains. Warm search behavior is unchanged.

Pretext retains one shared, width-independent preparation for adjacent instances with matching
text, boundary, ellipsis, font, letter spacing, white space, and word break. Instances retain their
own preparation for subsequent resizes. The shared entry holds no elements or rendered results;
combined text, marker, and font input length is capped at 8,192 UTF-16 code units. This favors
repeated labels and duplicate content without introducing an unbounded cache or a result cache.

Font invalidation immediately discards the shared entry and each affected instance's preparation.
Pretext's global measurement cache is cleared once before the next preparation, coalescing a batch
of invalidations without changing per-instance font or resize observation. Width-only predictions
do not check this flag or clear caches.

## Inline evidence

The immutable baseline includes the preceding Pretext reliability fixes. Built baseline and
candidate entries ran in the same Chromium process with alternating target order. The initial
14-scenario Inline comparison retained identical structural counters in the 11 existing controls.
Six cold split rows then covered start, middle, end, short bodies, unequal glyph widths, and affixes
that exhaust the available width. Each row used 16 instances and six same-width text updates.

| Six cold split rows                      | Baseline | Candidate | Change |
| ---------------------------------------- | -------: | --------: | -----: |
| Bounding-box reads                       |    4,032 |     4,608 |   +576 |
| Scroll-width reads                       |    4,968 |     2,424 | -51.2% |
| Combined geometry reads                  |    9,000 |     7,032 | -21.9% |
| Mutation records                         |    8,124 |     5,760 | -29.1% |
| Sum of active medians, counters disabled | 143.8 ms |  127.9 ms | -11.1% |

The counters-disabled comparison used seven samples per row. Individual active-time RME ranged
from about 3.6% to 24%, so structural reductions support the decision more strongly than individual
timing percentages. The skewed-glyph row kept combined geometry and mutation counts neutral; the
other five reduced both. Exhaustive browser-candidate comparisons cover unequal glyph widths,
mixed scripts, word/grapheme boundaries, all location aliases, a numeric ratio, and text updates.

## Pretext evidence

A counterbalanced production-build comparison mounted 200 instances with either identical or
distinct roughly 600-character multilingual strings. Seven measured rounds followed an initial
warmup round for each target. All visible outputs matched between targets.

| Cold workload metric                             | Baseline | Candidate |
| ------------------------------------------------ | -------: | --------: |
| Identical text: prediction observer callback CPU |  43.1 ms |    2.1 ms |
| Identical text: settled mount duration           | 106.4 ms |   64.5 ms |
| Distinct text: prediction observer callback CPU  |  41.0 ms |   41.1 ms |
| Distinct text: settled mount duration            | 106.5 ms |  106.2 ms |

The roughly 95% callback reduction applies to identical preparations, not general rendering or
unique-content workloads. Settled duration includes frame waits and is a secondary signal. An
instrumented 1,000-predictor diagnostic reduced segmentation calls from 28,008 to 36 for identical
text while distinct-text calls stayed at 28,998. The retained source benchmark reports cold mounting
for both repeated and distinct text, separately from resize cost.

Regression coverage verifies shared preparation reuse, every modeled cache input, the retained-size
bound, font invalidation, and two shared-font instances updating after a late font load.

## Delivery cost

Production-minified isolated consumer bundles, with Vue external:

| Import             | Baseline gzip | Candidate gzip |  Delta |
| ------------------ | ------------: | -------------: | -----: |
| InlineClamp        |       5,273 B |        5,321 B |  +48 B |
| Standard LineClamp |       9,584 B |        9,584 B |    0 B |
| Pretext LineClamp  |      29,236 B |       29,373 B | +137 B |

No public API or CSS accuracy contract changes. Broader prepared-result pools, general cross-instance
observation, and Rich/Wrap representation changes are not implied by these narrow results.
