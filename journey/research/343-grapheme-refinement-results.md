# Browser-verified grapheme refinement

This work compares with `97658cf` (`perf: optimize clamping and preserve Pretext grapheme behavior`),
the committed version preceding the refinement exploration. It does not compare with npm 1.6.0.

## Retained design

Non-native `LineClamp` end/grapheme clamping now searches across word transitions before refining the
last possible word. Both entries use the same browser-measured search, DOM, accessibility,
observation, batching and controls. Native CSS remains first, and eligible word-boundary Pretext
prediction keeps its existing separate policy. There is no new public option. The additional
Pretext grapheme-hint implementation was measured independently and removed.

The new search applies to end/grapheme `maxLines` without `maxHeight`. Start, middle, height-based,
word-boundary, Inline and Rich candidate policies remain separate. The shared measurement driver
also closes suspended generators on cancellation or errors, which is necessary for temporary
wrapping probes to restore their CSS.

### Why an ordinary final-line binary search was insufficient

[Research 342](342-pretext-grapheme-refinement.md) established two distinct problems:

- Pretext's normal line walker stops at a whole-word line end even when the requested grapheme cut
  could retain part of the next word. Cached or freshly shaped widths can improve the prediction,
  but cannot establish exact browser layout.
- The previously measured reference itself sometimes missed a longer fitting prefix. For ordinary
  Latin prose, attaching the marker to the end of one word can overflow; moving it into the next word
  restores a break opportunity and can make the longer candidate fit. A global binary search can
  miss that second fitting interval. Thai dictionary segmentation can also make bare prefixes
  non-monotonic, so an unmarked binary-search result is not a general upper bound.

Two retained real-component regressions demonstrate the correction with three lines, 16px Arial and
a 48px after affix. The Thai case uses `overflow-wrap: break-word`:

| Source and width | Committed result       | Descending browser result, now retained |
| ---------------- | ---------------------- | --------------------------------------- |
| English, 91px    | `Vue Clamp keeps den…` | `Vue Clamp keeps dense app…`            |
| Thai, 84px       | `ทีมตอบสนองเหตุ…`      | `ทีมตอบสนองเหตุกา…`                     |

The root entry and optional entry both match the longer result. Tests also revisit widths after
growing to full fit, so a favorable initial hint cannot hide a history-dependent cut.

### Search domains and evidence

For supported horizontal LTR flow with ordinary wrapping and nonnegative spacing, the coarse
candidate keeps the whitespace before a word and appends the marker there. The marker therefore
does not enlarge the preceding completed word. This gives a lower candidate for the next word;
the actual final candidate still trims the cut normally. After selecting the last possible word,
the search verifies its grapheme cuts in the browser.

| Context                                                                                           | Retained treatment                                                                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ordinary Latin alphanumeric and supported CJK token advances                                      | Local binary search inside the word; a fresh matching anchor verdict can be reused.                                       |
| Punctuation, discretionary breaks and other contextual tokens                                     | Descending checks inside the selected whitespace-delimited token.                                                         |
| Arabic or Syriac source/marker                                                                    | Existing descending measured search.                                                                                      |
| Negative spacing, text transforms, leading combining/joining markers or dictionary-script markers | Conservative full-source Range bound when available, then descending marked checks.                                       |
| Pure Thai with `overflow-wrap: break-word` or `anywhere`                                          | Marked-prefix search under temporary `line-break: anywhere`, followed by descending marked checks under the original CSS. |
| Pure Thai with ordinary overflow, or long non-alphanumeric ASCII tokens                           | Existing measured search; relaxed wrapping cannot establish a valid bound when horizontal overflow is allowed.            |
| Unsupported flow                                                                                  | Descending measured search.                                                                                               |
| Ordinary unbroken tokens                                                                          | Existing candidate search; dictionary scripts and explicit discretionary breaks use descending checks.                    |

Range bounds inspect complete word prefixes in a single full-source layout. They use a range's top
relative to the last allowed content line's bottom; using its bottom incorrectly excluded taller
fallback glyphs in Firefox. Duplicate bidi fragments are deduplicated before selecting the line,
and transformed geometry cannot authorize a bound. A missing usable bound leaves the entire
remaining candidate domain available.

The character probe is limited to pure Thai when the authored CSS already wraps oversized words.
It keeps the marker during the relaxed search: removing the marker can change the break before an
after affix. [CSS Text's `line-break: anywhere`](https://drafts.csswg.org/css-text-3/#valdef-line-break-anywhere)
permits breaks around typographic units, including punctuation, without discretionary hyphenation;
`word-break: break-all` alone retains punctuation restrictions.

Crucially, a line-count limit does not itself forbid horizontal overflow. When the authored CSS
permits an unbroken run to overflow, forcing that run to wrap can increase its line count and
produce an invalid upper bound. A production URL case exposed this despite passing the earlier
`overflow-wrap: break-word` fixtures. The URL's committed prefix matched the independent browser
oracle, while the broader forced-wrap prototype removed up to 19 additional units. That prototype
is rejected. Long non-alphanumeric ASCII tokens retain the existing measured policy: full-token
descent was also too costly (119 to 256 layouts in the long-hyphen pilot). The 64-unit threshold
selects that conservative performance fallback; it does not establish a monotonicity theorem.

The retained Thai probe restores the exact inline style before verifying the marked result,
including the presence or absence of the style attribute. Attribute snapshots and attribute writes
avoid the empty-style residue found during the production HTML comparison.
Generator cleanup is exercised for an interrupted real probe and for serial/batched reader errors,
completion errors and cancellation.

These are scoped, browser-validated search domains. They are not a universal monotonicity theorem
for arbitrary fonts, unusual shaping tables, every script or all CSS. Nor is the implementation a
claim of a globally optimal weighted search tree. In particular, fixes for non-monotonic layouts
can cost more than the previous binary search. Existing measured fallbacks remain outside the claim
of global maximality.

### Pretext hints: a measured alternative

The hint prototype walked preceding lines normally, then extended the final line using cached
segment advances after reserving the marker and observed affix widths. It supplied only a UTF-16
starting offset, never a fit verdict or certified bound. Browser verification matched the oracle
with and without this hint. A normalized source that differed from the DOM source could not provide
the hint. No extra cumulative array was built for every source grapheme.

Eager preparation was rejected first: in the four-round cold-update pilot, twelve distinct
6,000-unit sources grew from about 102ms to 208ms over twelve changes, despite fewer layouts.
Deferring preparation to compatible width changes removed that repeated cold-update work. The
prototype then used one preparation per instance and one shared entry bounded to 8,192 combined
source/marker/font units, with typography and boundary-domain invalidation.

The component comparison held the measured refinement constant: the same frozen package
served a root entry, an optional entry with hints, and a duplicate root control. Imports/fonts were
warm and the first of twelve resizes paid the prediction preparation cost. Eight paired rounds
gave the following results; these are **additional** effects of the hint over measured refinement,
not comparisons with the old committed solver.

| Scenario                      | Instances | Hint task change [95% interval] | Duplicate-root control | Layouts, measured → hint |
| ----------------------------- | --------: | ------------------------------: | ---------------------: | -----------------------: |
| Ordinary prose, after         |        12 |              +0.4% [−5.6, +6.9] |                  +4.6% |                  96 → 74 |
| Custom marker                 |        12 |              −0.6% [−5.9, +5.6] |                 −10.7% |                  92 → 75 |
| Mixed CJK, after              |        12 |             +8.6% [+4.5, +13.5] |                  +2.9% |                  90 → 90 |
| Distinct large sources, after |        12 |             +7.7% [+4.3, +11.8] |                  +1.7% |                 123 → 73 |
| Positive letter spacing       |        12 |             −8.3% [−18.9, +4.8] |                  +0.2% |                  96 → 76 |
| Auto width                    |        12 |              −3.0% [−7.3, +1.6] |                  −2.3% |              1,020 → 756 |
| Ordinary prose, after         |         1 |            +17.7% [+5.9, +34.1] |                 +16.1% |                  96 → 74 |
| Distinct large source, after  |         1 |            −12.9% [−24.3, −0.7] |                 −13.7% |                 109 → 73 |

The single-instance control variations are as large as the apparent effects. None of these rows
establishes an additional throughput gain beyond the measured refinement. The twelve-instance
CJK and large-source rows regress despite the latter doing fifty fewer layouts.

A separate fully warm experiment performs twelve untimed updates before every measured sequence,
then records twelve paired rounds. All targets start the timed sequence from the same last width
of the warm sequence, so layout counts differ from the fresh-mount comparison above.

| Scenario, twelve instances    | Hint task change [95% interval] | Duplicate-root control | Layouts, measured → hint |
| ----------------------------- | ------------------------------: | ---------------------: | -----------------------: |
| Ordinary prose, after         |              −1.2% [−6.7, +4.8] |                  +0.9% |                  92 → 72 |
| Custom marker                 |             −9.5% [−16.4, −1.7] |                  −2.7% |                  90 → 73 |
| Mixed CJK, after              |             +5.5% [−1.7, +13.6] |                  −1.1% |                  88 → 88 |
| Distinct large sources, after |           −14.7% [−18.2, −11.3] |                  −8.0% |                 119 → 71 |
| Auto width                    |             −0.2% [−7.3, +10.8] |                  −1.4% |                972 → 732 |

The custom-marker and distinct-source cases do show an additional fully warm benefit in this
experiment. The large-source duplicate control also moves by about 8%, so its raw 15% result is
not a portable gain estimate. Ordinary prose and auto-width total-time benefits remain uncertain.
The hint is therefore not rejected on an assertion that it can never be faster: it is a specific
preparation/retained-memory trade-off with a narrower payoff than the common measured refinement.

Five post-GC heap samples after six warmups also expose a cost: twelve distinct large sources
retain about 2.07MB in the hint candidate versus 0.65MB in the committed package. Ordinary shared
sources stay near the control range. These are mounted-minus-empty heap measurements, not object
retainer attribution or a leak proof. The final implementation removes the grapheme hint, its
private predictor API and its cache-domain changes; the existing word predictor remains intact.
This selects the common browser refinement over maintaining an additional model for the selected
fully warm wins. The performance, payload and memory evidence for that alternative remains recorded
here so the decision does not erase its favorable cases.

## Correctness comparison

The differential corpus contains 28 explicit scenarios at 66 widths plus 96 seeded mixed-content
scenarios at nine widths: 2,712 cases per browser. It covers English, CJK, Thai, Arabic, Syriac,
mixed scripts, emoji and combining sequences, hyphens, soft hyphens, zero-width and nonbreaking
spaces, several markers, fonts, affix occupancies, line limits and positive/negative spacing.

Each case runs the committed and retained measured solvers. The independent oracle renders full
text first, then tries every marked grapheme cut in descending order. The current solver keeps its
width history across cases. The hint prototype was also tested against the same corpus before its
removal; the final solver was rerun after removing that code.

| Browser  | Cases | Committed solver differs from oracle | Retained measured differs | Explored hint variant differs |
| -------- | ----: | -----------------------------------: | ------------------------: | ----------------------------: |
| Chromium | 2,712 |                                   48 |                         0 |                             0 |
| Firefox  | 2,712 |                                   49 |                         0 |                             0 |
| WebKit   | 2,712 |                                   49 |                         0 |                             0 |

The saved UTF-8 results are checked against their raw strings, including agreement with the stored
comparison booleans and absence of replacement characters. These 8,136 cases are finite empirical
evidence; they do not imply equivalent coverage of all browser typography.

The complete Chromium suite passes 422 tests and the unit suite passes 111. Package and website
builds pass. An expanded Firefox/WebKit run passed 553 of 564 cases: ten failures were reproduced
against the frozen committed sources and tests (Rich precision/heuristic assumptions, font-event
mutation assertions, and Inline flex maximality). A website assertion assumed its asynchronous
overflow indicator had already appeared; retaining the assertion behind an eventual-state wait
passes all 42 Firefox/WebKit website cases and the 21 Chromium cases. The retained refinement,
font/cache, style-restoration and measurement-cleanup suites pass another 80 Firefox/WebKit cases
after the final search changes. No unrelated
runtime behavior was changed to disguise the baseline failures.

## Rejected approaches

- Treating a Pretext prediction or an ordinary unmarked-prefix binary search as a proven bound:
  contradicted by browser oracle cases, including Thai in Firefox.
- Fully descending the remaining source after a full-layout range estimate: accurate in the
  corpus, but about 12ms versus 5ms for the isolated English/after sequence. Unbounded Thai descent
  was about 208ms versus 20ms over 58 changes.
- Using the Range-bound strategy for every ordinary word search: around 7.4ms versus 5.5ms in the
  same isolated English scenario. Keeping word-start lower candidates avoids that extra layout.
- Applying local binary search to every token: hyphens and zero-width breaks exposed additional
  fitting intervals. Those token domains retain descending verification.
- Descending every mixed-CJK token: a production pilot grew from 87 to 384 layouts and roughly
  2.6 times the task duration. Restricting the local advance fast path to ordinary CJK characters
  and punctuation removed that regression; unsupported punctuation remains measured conservatively.
- Using relaxed character wrapping for ordinary English or long Latin tokens: additional layout
  work did not justify it. The wrapping-bound probe is retained only for Thai under the stated wrapping policy.

One early Range timing run overlapped a build and is excluded from timing conclusions. Isolated
solver times above explain rejected directions; they are not production component speedups.

## Production comparison method

Both packages are built and frozen before timing. The browser harness uses production Vue and
checks that its development prop warning is absent. Each cohort includes the committed package,
the retained package, and a second committed control; order rotates across eight recorded rounds
after one excluded warmup. Timings run separately from builds, tests and statistical analysis.

Production timing uses Chromium `151.0.7922.34`, a 1280×900 viewport, 16px Arial, 24px line height,
three lines and a 48px inline-block `More` after affix where selected. The resize trace is
`280, 260, 220, 180, 250, 330, 300, 190, 360, 240, 320, 210` CSS pixels. Ordinary prose repeats
`Operational dashboards keep ownership and incident context visible while surrounding panels change width. `
to the requested length; distinct/source-update cohorts add instance/revision prefixes. Custom
markers use `...`, and spacing cohorts use `1.25px` or `-0.5px`. Auto-width instances inherit the
changing wrapper width. The long-token, Thai and mixed-CJK controls are separate source profiles.

The frozen package JavaScript fingerprint is
`0a40fbf51988702fb83409c68071965241ddef91f0fe8d65a095272fac13260f` before and
`04600d05b86d48ff0e3f8aa38b9361324804f0914929ccaaf989d0e2b49d14ee` after. Final source files are
checked against the frozen source snapshot; all four final timing/heap runs use these same bundles.

Update cohorts change twelve widths or inputs per round. Imports and fonts are warm, but every
target is mounted afresh before its update sequence. The retained implementation does not prepare
a grapheme prediction; source and font cohorts pay their normal invalidation cost.
Before accepting a performance comparison, the harness requires identical final `outerHTML` for
every instance at every step, including styles, accessibility markup and affix state. Corrected
narrow-width cuts are established separately against the descending oracle, rather than mixing
different output work into the same-output timing claims.

`TaskDuration` is Chromium's accumulated browser task time over the sequence, including output
capture. It is neither input latency nor paint time. The deliberate frame waits in settled wall
time are not a speedup metric. `LayoutCount` counts physical browser layouts across all instances;
batching means it is not a per-instance fit-query count. Reported time changes use the geometric
mean of within-round retained/committed ratios, with a seeded paired bootstrap 95% interval. Eight
rounds provide a small, workload-specific sample. The duplicate committed control exposes run
variation; an interval containing zero does not establish an improvement or regression.

### Final twelve-instance updates

These results use the final frozen package after removing the Pretext hint. All counts and times
cover the complete twelve-update sequence, with eight paired rounds. Ordinary sources are 600
UTF-16 units; large sources are 6,000 units. Distinct sources include an instance-specific prefix.
The after affix is 48px. Negative time changes are faster.

| Scenario                              | Task ms, committed → retained | Paired task change [95% interval] | Committed control change | Layouts, committed → retained |
| ------------------------------------- | ----------------------------: | --------------------------------: | -----------------------: | ----------------------------: |
| Root grapheme, after                  |                 47.53 → 44.24 |               −6.4% [−13.7, +1.7] |                    +3.7% |                      121 → 96 |
| Pretext entry grapheme, after         |                 49.41 → 47.31 |               −7.3% [−13.5, −1.6] |                    +3.5% |                      121 → 96 |
| Root grapheme, custom marker          |                 41.35 → 40.35 |               −3.0% [−10.2, +4.6] |                    +1.5% |                       92 → 92 |
| Pretext entry grapheme, custom marker |                 40.97 → 44.41 |               +4.2% [−5.9, +12.6] |                    +5.5% |                       92 → 92 |
| Mixed CJK, after                      |                 46.10 → 45.00 |                −3.5% [−9.2, +2.3] |                    −1.3% |                       87 → 90 |
| Long unbroken Latin token, after      |                 46.27 → 46.16 |               −4.5% [−13.9, +4.2] |                    −3.1% |                       98 → 98 |
| Long hyphenated token, after          |                 49.73 → 49.62 |                −1.5% [−8.2, +5.9] |                    −7.6% |                     119 → 119 |
| Long URL, after                       |                 45.24 → 44.80 |               +3.6% [−7.3, +19.5] |                    +9.9% |                     110 → 110 |
| Thai, normal overflow                 |                 75.77 → 75.48 |                −0.3% [−3.6, +2.7] |                    −1.3% |                       95 → 95 |
| Thai, `overflow-wrap: break-word`     |                 76.02 → 92.12 |             +19.2% [+16.1, +22.8] |                    +0.7% |                      95 → 126 |
| Positive letter spacing, after        |                 44.34 → 45.77 |               +2.8% [−4.1, +10.1] |                    +8.5% |                       93 → 96 |
| Distinct large sources, resize        |                 63.36 → 58.82 |               −8.0% [−11.2, −4.7] |                    −0.8% |                     126 → 123 |
| Auto-width instances, after           |                 50.54 → 50.58 |                −2.1% [−7.8, +4.5] |                    +6.6% |                 1,320 → 1,020 |
| Word-boundary Pretext control         |                 42.38 → 43.73 |              −11.3% [−30.1, +8.6] |                    −6.4% |                       24 → 24 |
| Native grapheme control               |                 33.58 → 35.42 |               +3.9% [−2.2, +10.2] |                    −5.7% |                       12 → 12 |
| Replace ordinary source               |                 48.97 → 44.37 |               −8.9% [−15.0, −1.6] |                    −0.5% |                      120 → 60 |
| Replace shared large source           |               104.02 → 103.18 |                −0.8% [−1.3, −0.1] |                    +0.7% |                       78 → 60 |
| Replace distinct large sources        |               104.02 → 106.97 |                +2.8% [+2.3, +3.4] |                    +0.2% |                       63 → 60 |
| Change font metrics                   |                 76.10 → 75.99 |               −4.5% [−16.7, +6.7] |                    −3.0% |                       96 → 90 |
| Negative letter spacing, after        |                 45.35 → 58.73 |             +29.4% [+19.7, +40.1] |                    −2.2% |                     119 → 180 |

Rows without an explicit root/control label use the optional entry with grapheme boundaries;
its grapheme path is now the same measured refinement as the root entry. Native and long-token
policies retain their previous search. Custom-marker and auto-width elapsed-time improvements are
not established in this final sample, even where the latter performs 300 fewer layouts. The font
cohort alternates actual CSS font size and emits `loadingdone`; it does not measure downloading a
font. No general speedup is claimed for the unchanged native or word-prediction controls.

The strongest final twelve-instance time evidence is approximately 7% for ordinary after-slot
resizes, 8% for distinct large-source resizes and 9% for replacing ordinary sources. The root
ordinary-resize interval still overlaps zero despite reducing layouts from 121 to 96. Timing
variation is material; these are scenario results, not a combined library-wide speedup.

Correctness has visible costs. The supported Thai wrapping probe adds 31 layouts and about 19%
task time; the negative-spacing path adds 61 layouts and about 29%. Negative spacing has four
committed-versus-oracle mismatches per browser, including a 119px case where the old result ends
at `applicati…` while `application text rea…` fits. These conservative paths are retained to cover
observed failures, even though all outputs in the wider timing sequence agree. Replacing distinct
large sources adds about 3%; its word-domain preparation is not free. Unconstrained descending
search and unsafe character-wrap bounds are rejected as described above.

### Single-instance updates

| Scenario                              | Task ms, committed → retained | Paired task change [95% interval] | Committed control change | Layouts, committed → retained |
| ------------------------------------- | ----------------------------: | --------------------------------: | -----------------------: | ----------------------------: |
| Pretext entry grapheme, after         |                 21.43 → 20.41 |              −3.0% [−14.7, +15.1] |                   +20.7% |                      121 → 96 |
| Pretext entry grapheme, custom marker |                 19.21 → 19.51 |               +1.7% [−9.9, +13.3] |                    −5.8% |                       92 → 92 |
| Mixed CJK, after                      |                 24.70 → 24.79 |               +4.6% [−4.5, +15.4] |                    −8.4% |                       87 → 90 |
| Thai, `overflow-wrap: break-word`     |                 32.86 → 38.90 |              +12.7% [+1.5, +23.7] |                   −13.0% |                      95 → 126 |
| Distinct large sources, resize        |                 25.97 → 24.61 |                −2.0% [−9.9, +7.0] |                    −1.3% |                     115 → 109 |
| Replace ordinary source               |                 25.05 → 19.74 |              −22.1% [−34.6, −7.3] |                    −8.8% |                      120 → 60 |
| Replace distinct large sources        |                 33.70 → 34.17 |               −9.3% [−24.0, +1.2] |                    +2.3% |                       60 → 60 |
| Change font metrics                   |                 34.05 → 29.87 |              −6.7% [−22.6, +11.4] |                    −7.6% |                       96 → 90 |
| Negative letter spacing, after        |                 22.48 → 29.19 |             +26.6% [+12.5, +42.0] |                    +5.4% |                     119 → 180 |

Ordinary single-instance resize benefits are not established. Replacing the ordinary source is
faster in this sample, while Thai and negative-spacing correctness paths add work. The duplicate
control varies substantially in several small workloads, so isolated point estimates are not
portable latency predictions.

### Mount and retained memory

Mount comparisons warm imports and fonts and measure mounting plus normal settlement. They do not
measure module download, parse/initialization or first-ever font preparation. All mount intervals
include zero in the final sample; no mount-time improvement is claimed.

| Scenario                       | Instances | Task ms, committed → retained | Paired task change [95% interval] | Committed control change | Layouts, committed → retained |
| ------------------------------ | --------: | ----------------------------: | --------------------------------: | -----------------------: | ----------------------------: |
| Pretext entry grapheme, after  |         1 |                   2.65 → 2.66 |              +9.8% [−13.8, +40.7] |                    −1.4% |                       11 → 17 |
| Distinct large sources, resize |         1 |                   4.33 → 5.24 |              +5.7% [−29.2, +55.6] |                    +3.4% |                       13 → 14 |
| Native grapheme control        |         1 |                   1.67 → 1.55 |               −4.1% [−13.7, +6.3] |                    −1.0% |                         1 → 1 |
| Word-boundary Pretext control  |         1 |                   2.69 → 2.96 |              +6.6% [−26.1, +53.7] |                    +2.8% |                         2 → 2 |
| Pretext entry grapheme, after  |        12 |                   6.96 → 8.04 |              +3.8% [−16.4, +27.4] |                   −18.3% |                       15 → 23 |
| Distinct large sources, resize |        12 |                 19.68 → 20.23 |                +1.1% [−5.8, +8.4] |                    +4.8% |                       20 → 19 |
| Native grapheme control        |        12 |                   2.63 → 2.43 |              −14.8% [−34.5, +6.2] |                    +0.4% |                         1 → 1 |
| Word-boundary Pretext control  |        12 |                   4.36 → 4.77 |              +7.0% [−15.5, +35.3] |                    −3.5% |                         2 → 2 |

Heap measurements use five recorded post-GC samples after six excluded warmups. Each target runs
twelve updates before measuring mounted-minus-empty and then unmounted-minus-empty heap. The
numbers are descriptive medians; negative unmount deltas reflect GC/runtime variation and are not
memory savings attributable to the component.

| Source                      | Instances | Committed mounted bytes | Retained mounted bytes | Duplicate committed bytes | Retained post-unmount delta |
| --------------------------- | --------: | ----------------------: | ---------------------: | ------------------------: | --------------------------: |
| Shared 600-unit source      |         1 |                  47,340 |                 48,936 |                    44,632 |                      +4,164 |
| Distinct 6,000-unit sources |         1 |                  62,996 |                 65,052 |                    63,128 |                      +2,568 |
| Shared 600-unit source      |        12 |                 304,512 |                304,984 |                   298,708 |                          +0 |
| Distinct 6,000-unit sources |        12 |                 653,332 |                739,060 |                   653,652 |                      -3,468 |

The final twelve-instance distinct-source increase is about 84KiB (0.65MB to 0.74MB), much smaller
than the hint prototype's 2.07MB total. Ordinary shared-source results remain near the duplicate
control range. Browser DOM-node and listener counts match across targets. The word-transition
preparation lives in a WeakMap keyed by the existing prepared source, rather than a new global
strong source cache. These samples do not establish a leak proof or peak-memory bound.

## Payload

The same production consumer bundling procedure is used for both frozen packages: one ES entry,
tree shaking, esbuild minification, Vue external, gzip level 9. Pretext is bundled only for its
optional entry. Sizes are measured anew rather than copied from older reports.

| Import                 | `97658cf` gzip bytes | Retained gzip bytes |         Change |
| ---------------------- | -------------------: | ------------------: | -------------: |
| LineClamp              |               11,425 |              13,280 |         +1,855 |
| InlineClamp            |                7,606 |               7,657 |            +51 |
| RichLineClamp          |               15,445 |              15,473 |            +28 |
| WrapClamp              |                6,234 |               6,234 |              0 |
| All root exports       |               26,823 |              28,618 | +1,795 (+6.7%) |
| Pretext LineClamp      |               31,179 |              33,042 |         +1,863 |
| Both LineClamp entries |               31,191 |              33,055 |         +1,864 |

The root remains independent of the Pretext dependency. Both entries share the browser-corrected
grapheme search; the optional word predictor remains unchanged. Removing the hint prototype saves
492 gzip bytes in the optional entry compared with that experiment, as well as its grapheme-model
preparation and retention. The remaining root increase is the cost of the scoped measured search
and generator cleanup.
