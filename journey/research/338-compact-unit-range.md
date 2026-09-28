# Compact single-unit grapheme range

## Decision

Expand the former ASCII upper bound to U+02FF while retaining U+0020 as the lower bound and the
existing tab/LF exceptions. The implementation is integrated. Both eager and deferred word paths
use this admission rule; internal ASCII-specific names now describe single-unit boundaries.
There is no additional branch, lookup table, normalization, cache, language list or runtime dependency.
The rest of the working combination, including the still-retained warm Rich extension, is unchanged.

This revises the research-337 recommendation to keep the ASCII range unchanged. ASCII was a
conservative starting point, but this single upper-bound change covers precomposed accented Latin,
Latin extensions, IPA and spacing modifiers without creating a table-maintenance obligation.
The numeric comparison and regular-expression class are still the same shape. Stop at this compact
range rather than appending script and punctuation blocks without evidence.

## Safety and scope

U+0020–U+02FF contains 736 code points: 702 have Grapheme_Cluster_Break=Other and 34 have Control in
Unicode 13.0, 14.0, 15.0, 15.1, 16.0 and 17.0. Tab is Control and LF has its separate break property.
There is no CR, Extend, ZWJ, SpacingMark, Prepend, regional indicator or joining Hangul category in
the admitted alphabet. CR exclusion avoids CR×LF; the remaining applicable rules establish a break
between every admitted unit. This is an inference from the pinned property files and
[UAX #29 grapheme rules](https://www.unicode.org/reports/tr29/#Grapheme_Cluster_Boundary_Rules).
The first combining-mark block begins at U+0300, immediately beyond this range.

Admission still applies to the **entire source**. A decomposed accent, emoji, CR, `α`/`汉`,
curly quotation mark or other out-of-range character sends the whole source through native
`Intl.Segmenter`. There is no claim to accelerate every French, German or other language's text.
For example, `café` is admitted but `café` and `l’œuvre` are not. Word segmentation remains native,
and Arabic/Syriac candidate ordering remains unchanged. Admitted-range tests also compare cursive
classification with the original script-property check.

Native-oracle checks passed 18,352 preparation comparisons per engine over 4,588 sources in
Chromium 149.0.7827.55, Firefox 153.0 and WebKit 26.5. Cases cover all 738 admitted characters,
repetitions and tone-letter contexts, seeded admitted/mixed strings, surrogate errors, composed
sequences and Unicode-13/17 test vectors. Eager/deferred word and grapheme offsets, fallback offsets
and cursive flags match native behavior; 13 admitted normative vectors also match their prescribed
boundaries per engine. These are specific engine checks, not a promise against arbitrary future
tailoring. A small native-oracle regression in the unit suite keeps all admitted characters and key
fallback boundaries covered without shipping Unicode data.

## Marginal production measurements

Twenty instances, eight rotated baseline/candidate/duplicate-baseline rounds after warmup, 12 source
updates per sample, Chromium 149.0.7827.55. Long inputs contain 6,000 UTF-16 units and the decomposed
fallback contains 1,500; short input is `Café déjà prêt`. Exact settled markup matches every update.
TaskDuration includes output capture; intervals bootstrap paired mean log ratios with 10,000 resamples.

| Workload                                       | Baseline median | Expanded range median | Paired change, 95% interval |
| ---------------------------------------------- | --------------: | --------------------: | --------------------------: |
| Precomposed French, long distinct Line sources |       263.15 ms |             204.35 ms |  −22.34% (−23.28 to −21.27) |
| Short precomposed Latin Line sources           |        48.55 ms |              47.85 ms |     +1.48% (−3.12 to +7.56) |
| Existing ASCII, long distinct Inline sources   |       206.24 ms |             207.62 ms |     +0.85% (−0.55 to +2.56) |
| Decomposed Latin, distinct Inline fallback     |     2,325.44 ms |           2,314.55 ms |     −0.08% (−1.01 to +0.85) |

The precomposed long-text control was +0.48% (−0.60 to +1.25). Short and decomposed controls also
included zero. The ASCII duplicate control shifted +1.75% (+0.59 to +2.87), so its small candidate
variation is not an established regression. Only the admitted long-text row establishes a gain;
these measurements do not imply an improvement for short inputs or out-of-range text.

An initial mixed Indic/emoji fallback fixture was stopped before producing measured rows. Completed
rows from the first three workloads were retained, and the separate decomposed-Latin fallback run
completed all eight rounds. The incomplete fixture contributes no performance claim.

## Delivery cost and evidence

The integrated implementation passes 91 unit tests, 342 Chromium browser tests, the format/lint/type
gate and both library and website production builds.

Consumer gzip changed by +28 B for LineClamp, +6 B for InlineClamp, +3 B for RichLineClamp and 0 B for
WrapClamp. All root exports changed from 26,512 to 26,272 B; that decrease reflects bundling and
compression interactions and is not an architectural size saving. No Unicode data ships.

[Measurements](./338-evidence/measurements.json) preserve every completed timing row, controls,
bundle sizes, property counts, engine results and bundle fingerprints.
[The source patch](./338-evidence/range.patch) applies after the reconstructed current baseline from
research 336. [The fixture patch](./338-evidence/fixtures.patch) applies to the baseline production
comparison driver. Run its four table scenarios with counts 20, rounds 8 and steps 12; scenario IDs
are stored in the measurements.

[The native oracle](./338-evidence/oracle.mjs) runs from the workspace with `vp exec node`, followed
by an experiment directory containing `baseline/src` and `range/src`, and a directory containing the
Unicode-13/17 `GraphemeBreakTest.txt` files named with their version prefix. Those files are available
from the [Unicode 13](https://www.unicode.org/Public/13.0.0/ucd/auxiliary/GraphemeBreakTest.txt) and
[Unicode 17](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakTest.txt) UCD archives.
Browser executable overrides use `VUE_CLAMP_CHROMIUM_PATH`, `VUE_CLAMP_FIREFOX_PATH` and
`VUE_CLAMP_WEBKIT_PATH` if the installed Playwright defaults differ. The corpus and checks are the
same as the measured oracle; the archived runner accepts paths instead of embedding machine paths.
