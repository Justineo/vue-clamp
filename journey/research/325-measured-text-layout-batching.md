# Measured text layout batching

## Decision

Retain a narrow cross-instance measurement path for plain text, with serial fallbacks and a
joining-script correctness fix. The objective from research 324 is total browser work, including
information acquisition and preparation. This implementation reduces repeated layout flushes; it
does not replace measured answers with a cache or claim a universally optimal search policy.

The baseline is the local implementation after research 323's Line text-leaf memo and before this
change. It already includes the preceding 1.7 work. These figures are incremental improvements over
that baseline, **not** a comparison against published 1.6.0.

## Runtime boundaries

These are the boundaries of this initial implementation. Research 326 extends Line batching to
slot-bearing, cold, and source-reset work, with additional position and settlement safeguards.

- Candidate search has one resumable implementation. Synchronous callers drive it directly; eligible
  measured text instances pause between candidate writes and browser reads. A measurement round
  finishes all writes before its reads, then starts the next round. Latin hint/probe order is retained.
- Eligibility requires nonempty markers and explicit inline width evidence: a content-independent
  length, or a percentage whose immediate parent has an explicit content-independent inline width.
  Intrinsic sizing remains serial. This gate does not infer isolation from a stylesheet fingerprint.
- Empty markers remain serial. A real sibling selector regression used
  `:has([data-part=body]:empty)` to enlarge the next clamp's font. Unrestricted batching returned
  `Dash…oard` where the current-font exhaustive oracle allowed only `…d`. The serial fallback and
  corresponding browser regression preserve that selector behavior.
- Line keeps cold/source-reset, full-fit, slot-bearing, and predictive work outside batched search.
  Its native, full-source, affix, and predictor observations remain independent. Inline's native
  partition still installs no measured observer.
- A shared observer is useful only because its measured subscribers can now suspend their searches.
  It gathers their requests in one delivery; sharing callbacks alone did not reduce layout work in
  the earlier prototype. A lone measured subscriber runs directly and avoids the batch queue.
- Completion runs in Vue's post-flush phase after all candidate writes have finished. No animation
  frame or timer delays the resize search. Final text, accessibility state, and validity checks stay
  with the component; disposed or superseded Line work cannot commit to an old root.
- Inline semantic updates retain the previous visible snapshot until the solved result is ready.
  Publishing the full source while waiting for the batch caused avoidable intermediate renders.
- Rich structural candidates and Wrap item candidates remain synchronous. Research 313's rejection
  of structural candidate batching still applies: changing elements can couple arbitrary selectors
  and shared layout. The new path is not permission to generalize to those representations.

Explicit width evidence and unchanged element structure narrow the supported path; they are not a
universal proof for arbitrary CSS, fonts, or content-dependent constraints that override those
widths. No containment or shadow boundary is imposed on consumer content.

## Shaping correctness

The Arabic middle-truncation example from research 324 is a real counterexample to monotonic rank
search: at 188px, candidate 33 measured 192.1875px while candidate 34 measured 187.453125px. Rejecting
33 does not prove that 34 overflows. The old result retained only 31 boundary units.

Preparation now records whether the source contains Arabic or Syriac script characters. Measured
Line and Inline search those candidate ranks from largest to smallest, also accounting for a
joining-script marker. The first fitting rank is maximal without a fixed lookahead cap. The
full-source exception and word-to-grapheme fallback are retained.

This deliberately trades throughput for correctness on long joining-script text: a narrow clamp
can require a linear number of complete-candidate reads. It is not counted as a performance win.
Other scripts retain the existing search policy; arbitrary typography does not acquire a universal
monotonicity guarantee from this change.

Browser oracles enumerate the candidates in the current font and fixed measured width. They cover
Arabic Inline grapheme/word output at two font sizes across shrink, growth, full-fit restoration,
and source replacement, plus measured multiline Arabic word output at middle/end locations.
Additional E2E coverage checks consecutive text/root changes, fixed-basis flex siblings, external
resize completion before the following animation frame, selector coupling through empty markers,
and unmounting. The external-resize test captures visible output before constructing its oracle.

A stricter one-`nextTick` assertion for consecutive Line source/root replacements failed against the
baseline too. That case uses the existing browser settlement contract instead of inventing a new
promise timing guarantee. Initial and ordinary updates retain their existing accessibility tests.

## Production measurement method

`tools/benchmark/scripts/measure-layout-batches.mjs` imports the two built package entries with the
production Vue runtime and asserts that development prop validation is absent. Chromium
149.0.7827.55 runs at a 1280 × 900 viewport with Arial 16px / 20px. Each measured run performs twelve
width transitions after mounting and settling the components:

`340 → 310 → 285 → 260 → 235 → 210 → 185 → 230 → 290 → 360 → 300 → 245 → 195`.

There is an untimed warmup for each target/scenario/count. Eight measured rounds rotate baseline,
candidate, and an identical-baseline A/A control. Body HTML is compared after every transition,
outside the timed section. Inline split uses a stable split callback so a width change does not
silently become a source-preparation benchmark.

Vue-update timing includes the update and Vue settlement. External resize starts at the width
write inside an animation frame and ends after resize delivery and its measurement/reactive
microtasks. Fixed waits between frames are excluded. The external value is a rendering interval,
not a pure JavaScript callback duration. Callback CPU alone would undercount work moved into a
post-flush microtask.

A separate `--metrics` run uses Chrome's native Performance domain to count actual layouts and
layout duration. Timing runs do not install DOM spies or enable these metrics. The table's 95%
intervals use paired millisecond differences and the eight-round Student t interval, normalized by
the baseline mean. Tiny single-instance measurements and A/A variation limit any fine-grained claim.

## Measured results and limits

Each row below uses 16 instances and eight paired rounds of the final relevant runtime. Timings
are milliseconds for the whole twelve-transition run. Percentage estimates use paired means;
they need not equal the ratio of the two medians.

| Workload                    | Baseline median | Candidate median | Paired change |     95% interval | A/A change |
| --------------------------- | --------------: | ---------------: | ------------: | ---------------: | ---------: |
| Inline middle / Vue         |           27.50 |            12.45 |        -54.6% | -60.5% to -48.7% |      -2.6% |
| Inline split / Vue          |           28.65 |            13.85 |        -51.9% | -57.5% to -46.3% |      -2.3% |
| Line word / Vue             |           23.75 |            14.90 |        -37.9% | -43.6% to -32.2% |      +2.0% |
| Inline middle / external    |           53.75 |            40.90 |        -30.5% | -46.2% to -14.7% |      +2.8% |
| Line word / external        |           43.45 |            36.45 |        -19.7% |  -37.4% to -1.9% |      -5.1% |
| Line affix / Vue control    |           23.55 |            24.25 |         +3.9% |   +0.4% to +7.4% |      +1.6% |
| Line full-fit / Vue control |            5.50 |             5.85 |         +6.2% |  -2.3% to +14.7% |      +0.7% |

This is a substantial multi-instance gain, not a universal improvement. The affix control retains
about 4% overhead (roughly 0.7ms between medians across twelve updates of sixteen components), even
with independent observation. Full-fit timing is inconclusive. The shared resumable search and
settlement integration have a small cost when there is no iterative layout work to share.

All seven final single-instance paired intervals cross zero. The lone-instance fast path removes
the earlier demonstrated queue penalty, but the short samples do not establish either a general
single-instance gain or exact performance neutrality. In particular, Line word's single-instance
median was 2.05ms before and 4.60ms after, with a very wide −21.7% to +114.3% paired interval. Keep
that uncertainty visible rather than treating the multi-instance percentage as a per-component gain.

Chrome native metrics from a separate three-round, 16-instance run:

| Workload                 | Layout count, baseline → candidate | Layout time median, baseline → candidate |
| ------------------------ | ---------------------------------: | ---------------------------------------: |
| Inline middle / Vue      |                         1371 → 102 |                         22.47ms → 7.46ms |
| Line word / Vue          |                           812 → 62 |                         16.76ms → 8.67ms |
| Inline middle / external |                         1666 → 124 |                        35.91ms → 26.89ms |
| Line word / external     |                           812 → 62 |                        30.33ms → 21.25ms |

Fewer layout flushes accompany the elapsed-time gains without requiring an eager candidate-width
index. These counts are distinct from the number of geometry getter calls. The batched text still
acquires current-layout answers; its candidate reads are no longer each charged a separate layout.

## Delivery cost

Single-component consumer bundles, minified with Vue external and measured with gzip level 9:

| Import        | Baseline gzip | Candidate gzip | Increase |
| ------------- | ------------: | -------------: | -------: |
| InlineClamp   |        5321 B |         6155 B |   +834 B |
| LineClamp     |        9622 B |        10731 B |  +1109 B |
| RichLineClamp |       13215 B |        13393 B |   +178 B |
| WrapClamp     |        5482 B |         5560 B |    +78 B |
| Pretext       |       29416 B |        30536 B |  +1120 B |

The approximately 0.83KB Inline and 1.11KB Line gzip additions are a real delivery trade-off for
this throughput improvement. Rich and Wrap also retain small generator-adapter costs despite not
using batched search. Root imports still exclude Pretext itself; the Pretext row includes its engine.
No broad bundle-size reduction is claimed.

The root entry SHA-256 values identify the measured baseline (`75ac502372ed519f…`) and retained
candidate (`2e0a97076999edc40…`). Timing artifacts retain every individual round rather than only
aggregated percentages.

## Public workload and content-update costs

The full 135-scenario public matrix passed for both entries, covering 45 Line, 17 Inline, 46 Rich,
and 27 Wrap scenarios. All existing fit-read and mutation counts matched except seven Inline source
replacement rows. Those exposed the intermediate-render cost described above and were rerun after
removing it. These instrumented runs establish work counts, not the timing claims above.

| Final source-update row | Bounding reads, baseline → candidate | Mutations, baseline → candidate | Fit reads      |
| ----------------------- | -----------------------------------: | ------------------------------: | -------------- |
| Inline text             |                            672 → 480 |                     1308 → 1100 | 660, unchanged |
| Split start             |                            768 → 576 |                     1236 → 1028 | 588, unchanged |
| Split middle            |                            768 → 576 |                       960 → 752 | 288, unchanged |
| Split end               |                            768 → 576 |                       876 → 684 | 396, unchanged |
| Split short body        |                            768 → 576 |                       768 → 576 | 288, unchanged |
| Split skewed body       |                            768 → 576 |                     1248 → 1056 | 672, unchanged |
| Split affix-heavy       |                            768 → 576 |                       672 → 480 | 192, unchanged |

The last observation partition and singleton changes received the complete 314-test browser suite,
including the seven new E2E cases. The 81-test unit suite, format/lint/type checks, and package plus
website production builds also pass. No public API or runtime dependency was added.

## Reproduction

Keep a built baseline package directory before editing, then build the candidate. Run from the
workspace root, substituting that directory for `/path/to/baseline`:

```sh
vp run build
VUE_CLAMP_BATCH_ROUNDS=8 VUE_CLAMP_BATCH_COUNTS=1,16 \
VUE_CLAMP_BATCH_SCENARIOS=inline-middle,line-word,inline-split,line-affix,line-full,inline-middle-external,line-word-external \
vp exec node tools/benchmark/scripts/measure-layout-batches.mjs /path/to/baseline

VUE_CLAMP_BATCH_ROUNDS=3 \
vp exec node tools/benchmark/scripts/measure-layout-batches.mjs /path/to/baseline --metrics
```

The command prints the temporary JSON artifact path, including individual rounds and the browser
version. The existing public package matrix remains the broader regression/counter fixture. Search
window tuning, eager width indexes, and authoritative result caching are not part of this change.
