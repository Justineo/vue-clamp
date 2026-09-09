# Language-independent grapheme preparation: rejected

## Decision

Do not ship the generated Unicode-property alphabet. It improved selected long-text update workloads,
but the roughly 2.1 KB gzip delivery increase was disproportionate for this library. InlineClamp
alone grew from 6,922 B to 8,975 B, almost 30%, while short text and existing ASCII workloads had no
established benefit. The existing Han fixture also regressed slightly. The user rejected this
trade-off after reviewing the results.

The retained policy permits simple, provably safe fast paths without enumerating language characters
or maintaining lookup data. Printable ASCII plus tab/LF uses numeric bounds and direct unit offsets;
other text uses native `Intl.Segmenter`. The dedicated Han/punctuation whitelist remains removed.
The four-entry preparation pool, Wrap growth probing and warm Rich batching remain implemented.
The generated table, generator, package license addition and dedicated table tests are archived only.

## Experiment and correctness evidence

The prototype admitted 53,857 public BMP characters in 392 ranges, using the intersection of
independent grapheme-break properties across Unicode 13.0, 14.0, 15.0, 15.1, 16.0 and 17.0. Restricting
admission to Unicode-13 assignments kept new/unknown characters outside the shortcut. One excluded
character caused the entire source to use native segmentation; native word segmentation remained
unchanged. Arabic/Syriac joining detection was independent of eligibility, preserving descending
candidate search for bare Arabic letters that became eligible for numeric offsets.

A first prototype incorrectly admitted private-use characters based on their default `Other`
grapheme property. WebKit 26.5 merges some characters around U+F860 according to platform tailoring.
The corrected experiment excluded the entire private-use category. This finding matters for future
attempts: default Unicode properties alone do not establish equivalence with every browser's native
segmenter. A full scalar version also passed after this exclusion, but added about 4 KB gzip.

The corrected BMP implementation passed 11,156 native-boundary comparisons per engine over 2,789
sources in Chromium 149.0.7827.55, Firefox 153.0 and WebKit 26.5. Coverage included every admitted
character, 86 admitted normative Unicode-13/17 vectors, mixed scripts, composed sequences, malformed
surrogates, private use and newer assignments. Production output screens also matched the previous
implementation for both fast-path and fallback sources. The experimental implementation passed 91
unit and 343 Chromium browser tests. These counts describe the experiment, not the retained source.

## Measured trade-off

The production comparison used 20 instances, distinct 6,000-unit sources and 12 source updates per
sample, with eight rotated baseline/candidate/duplicate-baseline rounds after a warmup. Exact settled
markup matched after every update. Chromium `TaskDuration` includes output capture and is not frame
rate or isolated segmentation time. Intervals bootstrap paired mean log ratios with 10,000 resamples.

| Source / component        | Before median | Prototype median | Paired change (95% interval) |
| ------------------------- | ------------: | ---------------: | ---------------------------: |
| Precomposed French / Line |     271.85 ms |        214.64 ms |  −20.84% (−21.56 to −20.04%) |
| Greek / Line              |     379.92 ms |        309.19 ms |  −18.71% (−19.09 to −18.36%) |
| Cyrillic / Inline         |     372.13 ms |        300.48 ms |  −19.37% (−19.93 to −18.87%) |
| Hangul / Line             |   1,611.34 ms |      1,543.54 ms |     −4.48% (−4.84 to −4.13%) |
| Existing Han / Line       |     851.12 ms |        866.13 ms |     +1.09% (+0.54 to +1.66%) |
| Existing ASCII / Inline   |     212.99 ms |        211.53 ms |     −0.58% (−1.62 to +0.36%) |

Duplicate-baseline intervals include zero in all six fixtures. A Japanese Rich prototype fixture
was layout dominated and showed no useful end-to-end gain. A large mixed-composition fixture was
stopped before measured samples; it contributes no performance claim.

| Consumer bundle  | Before gzip | Prototype gzip |   Change |
| ---------------- | ----------: | -------------: | -------: |
| LineClamp        |    11,761 B |       13,907 B | +2,146 B |
| InlineClamp      |     6,922 B |        8,975 B | +2,053 B |
| RichLineClamp    |    15,317 B |       17,547 B | +2,230 B |
| WrapClamp        |     5,995 B |        5,995 B |      0 B |
| All root exports |    26,601 B |       28,817 B | +2,216 B |

## Retained evidence

[Measurements](./335-evidence/measurements.json) preserve paired timings, controls, consumer sizes,
and engine-oracle counts. [The archived prototype](./335-evidence/unicode-prototype.patch) includes the generator, pinned source
hashes, Unicode license and regression tests. To reproduce it in an isolated checkout, first apply
[the historical baseline patch](./335-evidence/restore-experiment-baseline.patch), then the prototype
patch. Both are research evidence; neither belongs in production.

[The fixture patch](./335-evidence/fixtures.patch) applies to
`tools/benchmark/scripts/measure-update-costs.mjs`. Build baseline and patched candidate separately,
then use the six scenarios in the measurements with counts 20, steps 12 and rounds 8. Sorted
production-JS filename/content SHA-256 values identify the measured artifacts:

- Historical ASCII/Han baseline: `4ed60e17f341ec3b34388ae180edad7522654dd3883d051c264fdca421a0de47`
- Rejected prototype: `51f3af07c0352e6eb4621dde7b459ea5dc50b59240312ffd18dd788802184d05`

## Sources

- [UAX #29 grapheme cluster rules](https://www.unicode.org/reports/tr29/#Grapheme_Cluster_Boundary_Rules)
- [Unicode 13 assignment data](https://www.unicode.org/Public/13.0.0/ucd/UnicodeData.txt)
- [Unicode 17 grapheme-break properties](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakProperty.txt)
