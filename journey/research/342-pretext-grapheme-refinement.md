# Pretext grapheme refinement

> Historical exploration. The retained measured refinement and its comparison with `97658cf`
> are documented in [research 343](343-grapheme-refinement-results.md).

## Decision

The starting point is `97658cf`: native grapheme cases use CSS, other grapheme cases use the
standard measured engine, and eligible word cases use Pretext. This investigation does not change
that dispatch.

Filling the final line with graphemes is useful, but a purely predicted result is not yet suitable
for restoring grapheme prediction. Cached advances miss contextual marker width and browser
wrapping differences. Shaping candidate tails improves accuracy substantially; reflowing complete
candidates improves it further, but neither agrees with an independent browser oracle throughout
the tested corpus.

A second issue changes the acceptance criterion: existing measured output is itself history
dependent in some ordinary English affix cases. The marked-prefix fit predicate can fail and then
fit again at a larger rank. Prediction as a measured search hint can therefore change the answer
even though every submitted candidate is measured. Exact equality with the existing warm search
and the browser's longest fitting prefix must be assessed separately.

A further prototype first finds a browser-measured **unmarked prefix limit**, then scans marked
candidates downward from that limit. Pretext supplies only the first search's initial rank. It
matches the descending oracle on this corpus, but removing that seed exposes a Firefox Thai miss:
the bare predicate also has a rejection followed by acceptance. The successful seeded results
therefore do not establish a valid upper-limit proof.

## A concrete non-monotonic case

With `16px Arial`, `22px` line height, width `91px`, three lines, and a `48px` atomic `after` slot,
the source begins:

> Vue Clamp keeps dense application text readable while preserving the full source text…

The following candidates were independently rendered without CSS line clamping:

| Kept graphemes | Candidate                     | Browser line fit |
| -------------: | ----------------------------- | ---------------- |
|             19 | `Vue Clamp keeps den…`        | Fits             |
|             20 | `Vue Clamp keeps dens…`       | Does not fit     |
|             21 | `Vue Clamp keeps dense…`      | Does not fit     |
|             23 | `Vue Clamp keeps dense a…`    | Fits             |
|             25 | `Vue Clamp keeps dense app…`  | Fits             |
|             26 | `Vue Clamp keeps dense appl…` | Does not fit     |

Appending another source word moves the marker off `dense`. The completed word can move back onto
the preceding line, leaving room for the shorter marked word and the trailing affix. All three
browsers reproduce the rejection followed by acceptance.

The measured component approached through `84 → 91px` can stop at rank 19; the same width approached
from a wider result can reach rank 25. This is a limitation of the existing marked search's
monotonicity premise, not a font-metric error or a Pretext-only problem. A rejected successor is
insufficient to prove maximality here. The earlier Arabic/Syriac descending-search exception does
not cover this ordinary Latin case.

The unmarked control supplies a second counterexample. In Firefox, with the Thai fixture at `91px`
and the same `48px` trailing affix, bare rank 16 (`ทีมตอบสนองเหตุการณ์`) fails while rank 17
(`ทีมตอบสนองเหตุการณ์ต้`) fits. These verdicts come from fresh browser rects, without the measured
solver's height cache. The model-free upper-limit search consequently misses the longer marked
result in this case. Removing the marker does not make every script's prefix fitting monotonic.

## Prototypes

All variants preserve normal wrapping on preceding lines. A final-line refinement must include the
first overflowing word in its candidate window: shortening that word can move part of it back onto
the final line. The full source's existing final-line end is not a valid upper bound.

| Variant                      | Work performed                                                      | Role                                                                      |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Old walker                   | Existing `clampPreparedLine` with grapheme preparation              | Historical control; current runtime does not dispatch grapheme cases here |
| Cached tail                  | Complete-segment widths plus cached partial-grapheme advances       | Cheapest character-level prediction                                       |
| Shaped tail                  | Shape the candidate tail together with its marker                   | Include marker spacing and contextual width                               |
| Shaped tail, local search    | Start at the cached answer and shape only requested ranks           | Avoid an exhaustive tail-shaping scan                                     |
| Complete reflow              | Prepare and reflow each whole marked candidate                      | Separate final-line-window error from full-candidate layout-model error   |
| Measured hint                | Feed the cached prediction into the existing measured search        | Preserve actual DOM fit checks, without treating prediction as a verdict  |
| Unmarked limit               | Measure the largest bare prefix, then scan marked prefixes downward | Handle the demonstrated marked-predicate discontinuity                    |
| Unmarked limit without model | Use the existing measured rank estimate for the same upper search   | Check whether the upper limit depends on its starting rank                |

The shaped local search retains descending evaluation for joining scripts. It produces the same
strings as the exhaustive shaped-tail control on the complete three-browser corpus. The complete
reflow control retains original source whitespace for full-fit candidates and uses the line
walker's small fit tolerance for trailing-affix occupancy, rather than allowing an additional
half-pixel to move the affix onto another line.

The unmarked-limit prototype falls back to unrestricted descending measurement for Arabic/Syriac,
joining-script markers, and negative letter spacing. Otherwise it relies on two premises: unmarked
prefix fitting is monotonic, and adding the requested marker cannot make a rejected bare prefix
fit. The Firefox Thai counterexample disproves unrestricted use of the first premise.
In particular, arbitrary shaping or negative advances cannot be declared safe from source
grapheme boundaries alone.

## Browser evidence

The corpus contains 24 scenarios and one 66-width history per scenario: widths `84–490px` in `7px`
steps, fractional widths, a `1000px` full-fit transition, and return jumps. It covers Arial, Georgia,
monospace, English, CJK, Thai, mixed scripts, Arabic, Syriac, emoji/combining sequences, long tokens,
custom/empty/long markers, one/three/five lines, before/after affixes, positive/negative spacing,
`keep-all`, and `pre-wrap` with tabs and hard breaks.

Every width has two references:

- The existing measured solver, with the same preceding width history and displayed result.
- A separate browser oracle: try the full source, then render every marked grapheme candidate in
  descending order until the first fit. It uses the browser line predicate directly and neither
  a predicted bracket nor the measured solver's hint/binary policy.

Six representative scenario histories also run through actual Standard components: 396 component
outputs per browser agree with the low-level measured fixture. Affix wrappers and overflow-height
verification match the runtime. Comparing only isolated cold widths would hide the history issue.

There are 1,584 samples per browser. “Line failures” below count candidates rejected by the real
line-fit predicate after rendering, with no CSS line-clamp safety net; this is not a claim about
every possible horizontal-overflow or authored-CSS contract.

| Browser  | Variant                               | Equals measured history | Equals descending oracle | Line failures |
| -------- | ------------------------------------- | ----------------------: | -----------------------: | ------------: |
| Chromium | Old walker                            |                     779 |                      798 |            10 |
| Chromium | Cached tail                           |                   1,491 |                    1,522 |            31 |
| Chromium | Shaped tail / local search            |                   1,530 |                    1,561 |             1 |
| Chromium | Complete reflow                       |                   1,547 |                    1,579 |             1 |
| Chromium | Measured hint                         |                   1,558 |                    1,578 |             0 |
| Chromium | Unmarked limit, with or without model |                   1,552 |                    1,584 |             0 |
| Firefox  | Old walker                            |                     779 |                      800 |            10 |
| Firefox  | Cached tail                           |                   1,491 |                    1,523 |            31 |
| Firefox  | Shaped tail / local search            |                   1,530 |                    1,562 |             1 |
| Firefox  | Complete reflow                       |                   1,547 |                    1,579 |             1 |
| Firefox  | Measured hint                         |                   1,558 |                    1,578 |             0 |
| Firefox  | Unmarked limit                        |                   1,552 |                    1,584 |             0 |
| Firefox  | Unmarked limit without model          |                   1,553 |                    1,583 |             0 |
| WebKit   | Old walker                            |                     774 |                      794 |            45 |
| WebKit   | Cached tail                           |                   1,464 |                    1,495 |            68 |
| WebKit   | Shaped tail / local search            |                   1,495 |                    1,526 |            38 |
| WebKit   | Complete reflow                       |                   1,511 |                    1,543 |            38 |
| WebKit   | Measured hint                         |                   1,558 |                    1,578 |             0 |
| WebKit   | Unmarked limit, with or without model |                   1,552 |                    1,584 |             0 |

The existing measured histories match the descending oracle in 1,552 of 1,584 cases in each
browser. Differences therefore cannot all be charged to prediction. On Chromium,
complete reflow still misses one monospace cut, three `pre-wrap` cuts, and a Syriac full-fit case.
WebKit additionally exposes more monospace and `keep-all` metric/wrapping mismatches. A high average
agreement percentage does not make these prediction-only paths interchangeable with measurement.

## Cost evidence

These are serial, settled DOM-kernel measurements, not component-level production resize results.
Each sample performs 58 width changes over `160–460px`, with a continuous sweep and jumps. Every
method pays for a final displayed-layout read after each update; measured methods additionally pay
their candidate fit queries. The six profiles below return identical strings for all four measured
variants. They do not include the narrower correctness counterexamples above.

An initial eight-round run interleaved all prediction and measurement variants and showed sizable
A/A timing noise. A separate 16-round follow-up isolates the measured variants, excludes one warmup
round, rotates/reverses execution order, and retains a duplicate baseline. No build, test, or other
benchmark ran concurrently. Source preparation and font caches are warm; Vue updates, observer
delivery, multi-instance batching, painting, cold preparation, and payload cost are outside this
experiment.

Median milliseconds per 58 updates:

| Profile                    | Measured A | Measured B | Measured hint | Unmarked limit + model | Unmarked limit without model |
| -------------------------- | ---------: | ---------: | ------------: | ---------------------: | ---------------------------: |
| English + after            |       5.25 |       5.40 |          3.45 |                   4.35 |                         6.75 |
| English + custom marker    |       4.25 |       4.20 |          2.90 |                   3.90 |                         5.95 |
| CJK + after                |       5.00 |       4.90 |          3.90 |                   4.70 |                         6.40 |
| Thai + after               |      21.10 |      21.05 |         13.60 |                  20.30 |                        30.20 |
| Long token + after         |       5.85 |       5.85 |          5.30 |                   7.70 |                         9.70 |
| English + positive spacing |       4.80 |       4.90 |          3.35 |                   4.40 |                         6.60 |

The following changes compare the modeled unmarked-limit route with Measured A. Time changes are
paired geometric means with 95% bootstrap intervals over the 16 rounds. Geometry counts are
deterministic additional fit queries per sample, excluding the 58 shared final-layout reads; they
are not physical browser layout-flush counts.

| Profile                    | Fit queries: measured → unmarked limit |   Paired elapsed change |
| -------------------------- | -------------------------------------: | ----------------------: |
| English + after            |                              390 → 313 | −15.7% [−18.5%, −12.7%] |
| English + custom marker    |                              383 → 312 |   −8.0% [−10.2%, −5.8%] |
| CJK + after                |                              278 → 257 |   −6.5% [−10.5%, −2.1%] |
| Thai + after               |                              356 → 305 |    −3.5% [−4.2%, −2.7%] |
| Long token + after         |                              286 → 359 | +26.8% [+20.5%, +32.4%] |
| English + positive spacing |                              379 → 305 |  −12.8% [−18.5%, −8.6%] |

Paired A/A estimates range from −3.1% to +7.6%; the CJK control also has a small negative interval.
Small timing differences therefore deserve less weight than the repeatable query counts. The
long-token regression is material, and removing the model increases fit work in every profile
(524, 541, 374, 475, 473, and 534 queries respectively). The model contributes useful estimates,
but that does not prove the upper limit or remove its extra marked-candidate checks.

The direct measured-hint variant reduces queries to 206, 204, 184, 192, 224, and 197 respectively.
Its faster kernel results cannot override its different answers in the broader accuracy corpus.
Likewise, prediction-only timing does not establish equivalent behavior: the shaped local search
still differs from measured output in 10 of 58 long-token profile updates.

Separate prepared-call diagnostics from the mixed run put the cached-tail prototype around
`0.8–2.1µs` per call, local shaped search around `12–72µs`, exhaustive tail shaping around
`303–909µs`, and complete candidate reflow around `103–639µs`. Local search greatly reduces the
shaping prototype's work; it does not eliminate model errors. The original walk is near the timer's
resolution in these short batches, so no sub-microsecond speed ratio is inferred from it. These
figures characterize these prototypes and their cached-input conditions, not a lower bound on
possible implementations.

## Applicability and next decision

The cached model is useful as an estimate, but local DOM confirmation must account for the marked
predicate's discontinuities. Extending by a few graphemes and stopping at the first failure can
miss a later fitting word transition. Reusing the current measured binary search does not remove
that limitation.

The unmarked-limit route is not ready to adopt: the unseeded Thai failure makes a valid applicability
domain or a different browser-proven upper limit necessary. It also needs bounded work with long
markers and integration into the existing cooperative measured scheduler. Preparation, runtime
invalidation, same-width slot changes, production resize cohorts, and payload cost have not been established by these kernel
experiments. Source/typography changes are separate scenarios here, not an end-to-end font-loading
or observer-settlement test.

Current native/word/measured dispatch remains the accepted runtime behavior. Re-enabling a pure
grapheme prediction path is not justified by these results.

## Reproducibility

The source baseline is commit `97658cf`, with Vue `3.5.42`, Pretext `0.0.8`, Chromium
`151.0.7922.34`, Firefox `153.0`, and Playwright WebKit reporting Safari `26.5`. The explicit scenario
corpus, prototype implementations, all per-width strings and fit verdicts, and timing samples are
retained locally under `journey/research/342-pretext-refinement.local/`. The tables above preserve
the durable findings without requiring those ignored artifacts.

Primary implementation evidence is the pinned Pretext `layout.ts`, `line-break.ts`, and
`measurement.ts`, plus this package's `pretext/clamp.ts`, `text.ts`, `search.ts`, and `layout.ts`.
