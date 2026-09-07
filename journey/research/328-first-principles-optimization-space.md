# First-principles optimization space after mixed-component batching

## Scope and conclusion

This investigation reopens the optimization search after research 327. Earlier failed experiments
bound particular implementations and workloads; they do not establish that the current runtime is
optimal, or that another substantial gain requires a public API change.

The starting point is the uncommitted research 327 implementation, not published 1.6.0. All new runtime
implementations in this investigation are isolated prototypes. This document records evidence and
follow-up decisions; it does not mean that those prototypes have entered the package.

Three directions have real-component evidence worth taking into implementation review:

1. Continue Wrap's verified materialized growth geometrically when its initial budget is exhausted.
   This removes a large remaining cost in dense, nonuniform, no-after growth.
2. Share one bounded, width-independent text preparation between adjacent identical Line/Inline
   inputs. This targets multilingual source updates and repeated content, not general resize work.
3. Deliver font invalidation together, including the deferred multiline animation-frame callbacks.
   This lets existing measured batching work across native font events. Layout flush reductions are
   much larger than elapsed-time reductions, and Rich's structural font work remains serial.

Other credible directions remain: defer preparation until overflow is known; represent Rich cuts
compactly and resolve them lazily; specialize expensive source preparation for word mode. These need
additional integration experiments. Interpolation, source-position Range hints, representative-first
search, live computed-style wrappers, and consecutive duplicate-candidate reuse did not establish a
broad improvement in the implementations tested here.

## Model the work before choosing an optimization

The observable answer includes visible text or item prefix, the ellipsis and affixes, accessible
content, expanded/clamped state, emitted events, and the time at which that state settles. For Rich,
passive-content fallback, source structure, and preserved DOM identities also matter. Matching only a
cut rank or screenshot is insufficient.

A useful work model is:

`preparation + Vue/slot evaluation + candidate construction + style/layout work + geometry inspection

- final state settlement + allocation/retention + scheduling overhead`.

The number of API reads is not the number of layout passes, and the number of layout passes is not
the amount of layout work. Batching can replace many small passes with fewer larger ones. A new hint
must repay its acquisition cost; a current-DOM verification does not make that hint free.

Binary search's information bound applies to a monotonic boolean oracle. It is neither a bound on
all available browser information nor a proof that arbitrary CSS/text candidates are monotonic.
Arabic/Syriac shaping already requires descending plain-text search. Other scripts still use the
existing conditional hint/binary policy; this investigation does not turn that policy into a theorem
over arbitrary fonts, ligatures, wrapping rules, or selector-dependent layouts.

### Supported workload partitions

| Partition                                                          | Required work and constraint                                                                                                             | Remaining opportunity                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Native Line/Inline/Rich, eligible default ellipsis                 | Browser paints the clamp; observable clamped state still needs current overflow information. Preparation is already lazy in these modes. | Delivery and bytes; avoid claiming that measured-search improvements apply here. |
| Measured plain end/start/middle/ratio, word/custom marker          | Current candidate must fit actual width, typography and affixes; word mode can need grapheme fallback.                                   | Preparation, paid hints, candidate work and batching.                            |
| Measured `maxHeight`                                               | Visible geometry is relative to the current root; preceding peers can move that root.                                                    | Cheaper representations and synchronized reads, with root-position freshness.    |
| Rich transparent inline wrappers and atomic inline runs            | Inspect rendered support; preserve safe source structure and the visible/probe distinction.                                              | Lazy/compact cuts and narrower structural work.                                  |
| Rich unsafe or unsupported source                                  | Preserve the documented source fallback; do not clone active content to gain speed.                                                      | Avoid redundant setup, not a new permissive probe.                               |
| Wrap no-after/static flow                                          | Item slots are arbitrary; materialized shell probes can avoid calling them per candidate. Final public count needs fresh verification.   | Extend coverage beyond the initial grow budget.                                  |
| Wrap dynamic after or result-dependent item/affix work             | A changed count can change slot output and geometry. Cached widths are hints.                                                            | Reduce settlement/render cost without pretending the sequence is fixed.          |
| Cold mount, source reset, resize, font load, slot-only update      | They invalidate different state and enter different scheduling paths.                                                                    | Investigate each trigger separately; source and font wins are not resize wins.   |
| Single instance, identical cohort, distinct cohort, mixed families | Sharing only helps the portions that are actually common.                                                                                | Bounded pure data sharing; current-DOM hints; shared delivery.                   |
| Expanded, unconstrained, full-fit, hidden, SSR/hydration           | These are separate semantic states, not just different successful search ranks.                                                          | Defer unused work; preserve full-source and settlement contracts.                |

## Evidence and measurement boundaries

The full public baseline matrix passed all 135 rows (45 Line, 17 Inline, 46 Rich, 27 Wrap), using two
measured samples after warmup. This was a scope/cost inventory, not a precise release comparison.
Instrumented totals were:

| Family | Matrix active time | Time inside geometry APIs | `getComputedStyle` call time |
| ------ | -----------------: | ------------------------: | ---------------------------: |
| Line   |         5,411.3 ms |                2,766.3 ms |                       2.1 ms |
| Inline |         1,324.8 ms |                  469.7 ms |                         0 ms |
| Rich   |         6,331.7 ms |                2,784.5 ms |                      54.1 ms |
| Wrap   |         2,388.9 ms |                  955.2 ms |                      13.7 ms |

These totals weight the benchmark's chosen scenarios, not application traffic. Geometry API time
includes work forced by the calls and instrumentation overhead. Rich clone calls took 67.9 ms in
this matrix, whereas Wrap evaluated item slots 302,068 times. Neither count alone predicts user
latency, but the distribution argues against prioritizing a general style-wrapper cache or a large
Rich clone pool before measuring its ceiling.

Component experiments import built package variants and share the same **production Vue** runtime.
A wrong-type prop probe verifies that development prop validation is absent. Runs rotate baseline,
candidate, and an identical baseline control (A/A); timing and native CDP counters are separated where
appropriate. Every settled root's full `outerHTML` must match the baseline at every update. The
combined text-cache, full font-delivery and Wrap-growth prototype passed 303 existing component
browser tests plus ten targeted cache/lifecycle checks (313 total); this excludes the website demo
suite. Twelve scoped production-component fixtures per engine also matched baseline markup in
Firefox 153.0 and WebKit 26.5, covering source, resize, fonts, dense Wrap and singleton/four-instance
cohorts. Those concurrent cross-engine runs validate output only, not relative performance. This is
useful regression evidence, not a proof for every stylesheet or browser.

The timing browser was Chromium 149.0.7827.55. Focused source timing measures Vue/task settlement;
font/frame timings contain frame waits. Wrap work can continue through ResizeObserver after the first
Vue flush, so its early `ms` field is **not** a complete operation measurement. The follow-up Wrap
experiment records settlement through the next frame, plus native layout duration and layout count.
CDP TaskDuration includes the page/harness; it is not isolated library CPU. Vite also reports
ResizeObserver loop warnings in some dense fixtures. Do not turn those task-duration numbers into a
release throughput claim.

## Real-component candidates

### 1. Wrap: continue beyond the materialization budget

The current estimator includes the expected first overflowing item but caps materialization at a
per-line budget. If that upper candidate fits, the optimized path rejects and the remaining growth
can proceed one public item/count update at a time. Average/uniform-width hints cover many ordinary
cases, but heterogeneous tiny items and height-constrained cases still expose this gap.

The prototype keeps the existing first frontier. After shell search and a public count commit, it
checks the fresh sequence and before-affix dimensions. If the frontier fits and items remain, it
materializes one additional item, then increments of 2, 4, 8, and so on until an overflowing frontier
or the complete list is reached. Each chunk restores direct display mutations before yielding and
commits/verifies the result. A failed guard returns to the existing settlement path. It adds no new
static-after promise and does not cache user slot output.

This changes the number of expensive prefix renders beyond the initial frontier from potentially
linear to logarithmic for the eligible static case. It does **not** make all DOM measurement work
logarithmic: chunks still inspect materialized items, and actual item/slot costs remain relevant.

Fixture: 400 items, alternating 3 px/5 px widths, 16 px height, initial root width 64 px, followed by
1200, 64, 900, 120, 480, 64 px. Four paired rounds plus warmup; six updates per result below. These
are deliberately dense stress cases, not a claim about ordinary 40 px tags.

| One-instance scenario                   | Baseline layouts | Prototype layouts | Baseline settled time | Prototype settled time | A/A settled time |
| --------------------------------------- | ---------------: | ----------------: | --------------------: | ---------------------: | ---------------: |
| `maxHeight:48px`                        |              985 |               141 |              540.5 ms |                74.2 ms |         539.1 ms |
| Three lines with gaps                   |              281 |                62 |              206.5 ms |                64.7 ms |         206.3 ms |
| Mixed item heights                      |              532 |               123 |              210.9 ms |                65.3 ms |         214.8 ms |
| Static before                           |              754 |               139 |              480.7 ms |                90.6 ms |         481.4 ms |
| Before width changes with clamped state |              768 |               155 |              468.9 ms |                90.0 ms |         468.9 ms |
| Dynamic after, excluded from new path   |               35 |                35 |               48.5 ms |                48.8 ms |          48.7 ms |

The height fixture's native layout duration fell from about 60 ms to 8 ms. Four-instance held-out
variants also matched output and reduced layout work; do not multiply the one-instance percentage
into a general Wrap claim. Ordinary 60-item/42 px fixtures retained the same layout counts (19 for
height, 15 for lines, across six updates).

Implementation gate: retain all existing static-flow guards; cover the initial frontier, frontier
plus one, all-fit, dynamic-before changes, item/source mutation, hidden recovery and unmount during
chunk settlement. Audit selector-dependent widths and prove that any additional chunk carries the
same assumptions as the already accepted materialized path. This is the strongest new scenario
speedup, with a small prototype size cost.

### 2. Plain text: share preparation, not a layout answer

Rich and Pretext already share one bounded preparation. Measured Line and Inline still independently
segment identical source strings. The prototype adds a one-entry cache keyed by exact text and
boundary, bounded to 8,192 UTF-16 source units. Larger inputs evict the entry and use normal
preparation. Prepared arrays remain read-only; DOM, typography, width, hints and solved state remain
per instance. Native paths still avoid preparation.

48 instances, six roughly 600-unit source updates, eight rotated timing rounds:

| Scenario                        |  Baseline | Shared preparation | A/A control |
| ------------------------------- | --------: | -----------------: | ----------: |
| Line, repeated CJK              | 126.60 ms |          100.85 ms |   126.50 ms |
| Inline, repeated CJK            |  88.05 ms |           61.45 ms |    89.10 ms |
| Line, repeated Latin            |  46.15 ms |           43.20 ms |    47.85 ms |
| Line, repeated emoji/mixed text | 132.95 ms |          122.55 ms |   132.55 ms |
| Line, distinct CJK              | 134.70 ms |          136.70 ms |   136.15 ms |
| Inline, distinct CJK            | 122.35 ms |          122.15 ms |   123.50 ms |

A paired bootstrap of log timing ratios (10,000 resamples) places the repeated-CJK candidate/baseline
ratio at 0.764–0.810 for Line and 0.683–0.701 for Inline. These intervals describe this process and
fixture; they do not include browser/device or workload uncertainty. A 16-instance repeat also
improved (Line 41.25 → 33.25 ms; Inline 30.30 → 22.70 ms). Distinct and over-budget controls do not
establish a throughput improvement. Singleton timing is much noisier and must remain a separate
acceptance gate, especially for long cache misses. A suspicious initial 10,000-unit singleton miss
result was rerun with 18 rotated rounds and 16 updates: baseline 103.00 ms, candidate 102.50 ms,
A/A 102.25 ms; the paired ratio interval was 0.987–1.011, so the initial apparent regression was not
reproduced.

There is no benefit when adjacent inputs alternate between different texts or boundaries. Expanding
the cache to an LRU is a separate decision requiring observed reuse distance and a byte/retention
budget. The pure-preparation microbenchmark's near-total elimination of repeated segmentation must
not be reported as a whole-component percentage.

### 3. Fonts: preserve the batch across callback boundaries

Sharing a ResizeObserver does not merge separately invoked animation-frame callbacks. Each callback
can finish with an empty JavaScript execution stack and drain the Vue microtask that starts a batch.
A shared rAF callback instead invokes each eligible multiline request before that drain. This is the
relevant difference from the old observer/listener-hub experiment, which predated resumable search.
See the [HTML callback cleanup algorithm](https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script).

The first prototype shares the multiline font frame while preserving each instance's font epoch and
same-frame resize suppression. A second prototype additionally shares native `FontFaceSet` event
delivery; Inline and Wrap otherwise enter their runners through separate native event listeners.
The `ready`/loading completion contract still belongs to the actual font set, including per-instance
cleanup. The [CSS Font Loading event definition](https://drafts.csswg.org/css-font-loading/#font-face-set-events)
explains why synthetic dispatch alone is insufficient evidence for this scheduling path.

Real test: add/load/remove local-backed `FontFace`s, alternating Arial and Courier New, verify four
trusted `loadingdone` events per run, wait for final output, and compare identical markup. Twenty
instances, four load/reset cycles, three rotated counter rounds:

| Family | Baseline layouts | Shared frame only | Shared frame and native delivery |
| ------ | ---------------: | ----------------: | -------------------------------: |
| Line   |              648 |                40 |                               40 |
| Inline |              528 |               528 |                               34 |
| Wrap   |              168 |               168 |                               16 |
| Rich   |              888 |               888 |                              888 |

The first Wrap row uses fixed item widths and an explicit Arial item font, so it exercises
conservative event delivery. An additional natural-width Wrap fixture actually switches the item
font: 408 → 28 layouts, about 16.0 → 13.9 ms layout duration, but essentially unchanged task duration
(64.5 → 65.9 ms, A/A 64.8). This directly illustrates why flush reduction is not a throughput claim.

Singleton frame-only runs retained layout counts. Line layout duration in the shared-delivery run was
about 22.4 → 17.1 ms (A/A 21.3 ms); Inline and Wrap did not establish a corresponding general task-time
win. Synthetic same-width and font-size-change events also reduced Line layout counts, but those
stress repetitions are not the frequency of font loads in a real application.

Rich must restore and inspect structural candidates after font changes, so this proposal cannot
claim Rich's same-leaf warm batching applies to font invalidation. Implementation must preserve
Pretext metric invalidation, native/predictive behavior, cancellation before and during dispatch,
reentrant subscription, inactive/unmounted instances, and isolation if one callback throws. Seven
focused lifecycle checks cover subscription removal, pending-ready cancellation, cancellation during
delivery/frame execution, callback errors and repeated stale cleanup. The retained prototype patches
include the resulting hardening. Selective font-family invalidation is a different, previously
rejected optimization: research 312/313 could not fully represent inherited/descendant/fallback
metrics. This proposal coalesces conservative notifications rather than suppressing them.

## Mechanisms that were tested without a broad retention case

### More information can cost more than another fit probe

**Paid-width interpolation.** A safeguarded interpolation strategy consumed each candidate's width,
with binary fallback when progress was poor. The width simulation uses actual browser-measured
candidate strings, then models the integer/clamped information exposed by `scrollWidth`: a fitting
root's `scrollWidth` is not an intrinsic text width or a free measurement of unused capacity.
Thirty-six script/boundary/location cases covered 60 width limits each. Example total probes:

| Case                                    | Existing paid full-width hint/search | Interpolation |
| --------------------------------------- | -----------------------------------: | ------------: |
| Latin word, middle                      |                                  154 |           246 |
| CJK grapheme, middle                    |                                  316 |           210 |
| CJK word, end                           |                                  138 |           198 |
| Skewed narrow/wide glyphs, grapheme end |                                  600 |           686 |

The win depends on the distribution and does not justify replacement. Arabic cases also demonstrate
why an unguarded monotonic model is not a valid component correctness oracle. The production
joining-script descending branch is separate from this experiment.

**Range source-position hints.** This is different from the previously rejected aggregate Range
hint: binary-search a source boundary whose glyph box falls on the last allowed line, then use it as
a normal verified candidate hint. All 75 initial cases matched baseline output, including affixes,
word/grapheme boundaries, whitespace, letter spacing and tight line height. But current full-source
geometry describes that source, not the reshaped text plus ellipsis/after content. That limitation
follows from the [CSSOM View Range geometry contract](https://drafts.csswg.org/cssom-view/#dom-range-getclientrects).

In eight rotated timing rounds of 20 clamps, CJK word at 280 px reduced fit queries from 100 to 60 but
added 200 glyph Range queries: 9.60 → 12.15 ms. Latin word at 145 px was 5.80 → 11.20 ms. Emoji word at
280 px improved only 10.15 → 9.80 ms; most other cases regressed. Collapsed-caret geometry and hit
queries remain distinct untested variants, with whitespace, bidi, occlusion, offscreen and coordinate
mapping requirements. They are hints, not a maximality proof.

**Representative-first cohorts.** A minimal DOM experiment uses the actual preparation and candidate
search helpers. It first measures each instance's full source, batches one representative per text,
then gives followers the representative's rank; followers still verify their own candidates. It does
not reuse another instance's fit verdict. Twelve fixtures covered one/48 instances, repeated Latin,
CJK, long source, three source groups, mixed fonts and distinct text.

For 48 short identical instances, both approaches needed 864 reads; hierarchy increased batch read
rounds from 18 to 30 and writes from 1008 to 1149. Mixed fonts increased reads from 864 to 1440. Long
source reduced reads 1152 → 870 but left writes at 1152 and increased rounds 24 → 36. A three-group
case improved around 30.10 → 27.30 ms, while other cases and A/A variation did not establish a broad
win. Existing paid cold hints often already need only the fit and successor probes, leaving followers
little to save. Reopen only for a measured high-cost cohort; do not add a stylesheet fingerprint or
an authoritative cross-instance answer cache.

### Small local caches did not remove substantial browser work

- A WeakMap retained the **live** `getComputedStyle` object per Rich element, never frozen property
  values. The live-object behavior is specified by [CSSOM](https://drafts.csswg.org/cssom/#dom-window-getcomputedstyle).
  Eight rotated real-component rounds matched output but were flat: Rich resize 21.55 → 21.85 ms
  (A/A 21.70); affix resize 22.05 → 22.55 (A/A 22.05). Source update 85.25 → 83.30 was also matched by
  the A/A control at 83.50. This is not evidence for generic style caching.
- Reusing the verdict for an immediately repeated candidate string avoids a redundant geometry
  query when trimming maps two ranks to the same text. Six real-component scenarios retained
  identical native layout counts and did not establish a timing win. Line resize: 17.15 → 16.55 ms,
  but affix resize: 19.95 → 20.45 ms; source Latin: 29.80 → 29.50 ms versus A/A 29.45. Building all
  distinct candidate strings eagerly would add allocation/preparation to pursue a small opportunity.

### Preparation representations have narrower, still useful prospects

**Compact Rich cuts.** Keep one leaf path and numeric boundary offsets instead of a separate
`{path, offset}` object for every cut. The mechanism preserves every ordinary and fallback boundary
and includes HTML parsing in its timings. Thirty preparations of 30,000-unit Latin rich text took
7.40 → 3.90 ms in grapheme mode and 23.15 → 19.00 ms in word mode. The word fixture replaces 37,741
point objects with numeric references; this is an allocation count, not a heap-byte measurement.
Current run construction/rank flattening would recreate much of that work unless consumers resolve
cuts lazily. This is a preparation/memory candidate, not a measured Rich resize gain.

**Lazy word fallback.** Use `Intl.Segments.containing()` to validate word boundaries against grapheme
boundaries, and construct the complete grapheme fallback only if needed. The operation's semantics
come from [ECMA-402 Segmenter objects](https://tc39.es/ecma402/#segmenter-objects). Exact boundary
arrays matched across Latin, skewed text, CJK, emoji, Arabic and whitespace samples. For 100
preparations of 6,000 units:

| Source |    Eager | Lazy, no fallback | Eager with fallback consumed | Lazy with fallback consumed |
| ------ | -------: | ----------------: | ---------------------------: | --------------------------: |
| CJK    | 86.90 ms |          80.90 ms |                     86.50 ms |                   113.30 ms |
| Emoji  | 29.80 ms |          24.70 ms |                     29.70 ms |                    44.20 ms |
| Arabic | 40.85 ms |          24.50 ms |                     41.05 ms |                    54.75 ms |

A lazy property alone is insufficient: existing access order and Rich index construction can force
it. Integration must preserve long-token fallback and measure fallback-heavy controls. A new
segmentation implementation is not warranted just to improve an isolated preparation loop.

**Prepare only after overflow.** Native modes already avoid measured preparations. Measured plain
text currently constructs boundaries before its full-fit result; measured Rich creates searchable
metadata even though a full-fit result primarily needs support inspection and geometry. Separating
source identity/full-fit state from a known boundary rank could eliminate unused segmentation.
This has not been integrated or benchmarked here. For Rich, rendered support inspection must still
happen before accepting full fit. For both, warm full-fit/grow behavior and later shrink/fallback
must remain correct. This is a more promising question than another unconditional cache.

## Browser primitives and framework constraints

A capability-only check covered the installed Chromium 149.0.7827.55, Firefox 153.0 and WebKit 26.5
automation builds. It is not a browser support policy or a cross-browser performance result.

| Primitive                                                   | Chromium | Firefox | WebKit  | Interpretation                                                                                          |
| ----------------------------------------------------------- | -------- | ------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Unprefixed `line-clamp:3`, `auto`, or a custom block marker | No       | No      | No      | Draft syntax cannot replace the current engine yet.                                                     |
| Custom-string/two-value `text-overflow`                     | No       | Yes     | No      | A possible Firefox single-line enhancement, not a portable replacement for split/middle/word semantics. |
| Caret point query APIs                                      | Present  | Present | Present | Need source mapping and final candidate verification; viewport/occlusion constraints remain.            |
| Extended TextMetrics index/bounds methods queried here      | Absent   | Absent  | Absent  | Do not design a default optimization around unavailable methods.                                        |
| OffscreenCanvas / Segmenter `containing()`                  | Present  | Present | Present | Availability does not supply DOM layout or synchronous component settlement.                            |
| Inline-size containment / content visibility                | Parses   | Parses  | Parses  | These alter layout/freshness assumptions; parsing is not semantic equivalence.                          |

[CSS Overflow Level 4](https://drafts.csswg.org/css-overflow-4/) describes future custom block
ellipsis and automatic line-limit directions. The existing fully specified prefixed native partition
remains useful today. Any browser-specific enhancement must preserve deterministic server/first-client
markup and avoid recreating the hydration mismatch fixed in research 317. CSS feature detection
alone does not prove equivalence for the component's boundary, location, affix and state contract.

Vue computed caching tracks reactive dependencies; a slot that reads nonreactive DOM geometry or
ambient values can still legitimately change when the owner rerenders. Capturing its VNodes in a
computed does not automatically preserve that behavior. The previous child-item-component experiment
also lost parent invalidation and made mounting slower. A computed-in-parent design is a different
proposal, but it must demonstrate its invalidation contract rather than inherit assumed safety from
Vue's caching. See [computed caching](https://vuejs.org/guide/essentials/computed) and
[Vue rendering optimizations](https://vuejs.org/guide/extras/rendering-mechanism).

## Coverage map and decisions

“Not integrated” means the route still has an open experiment, not that it has been disproved.
“Contract” means a gain may be useful through a separate mode or API but cannot silently become
current default behavior. The table covers every term in the work model; it is not a claim to have
enumerated every possible algorithm.

|   # | Route                                                       | Evidence / next decision                                                                                                                                           |
| --: | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   1 | Broaden existing portable native eligibility                | Existing semantically exact subsets already use it; new cases need equivalence, not just fewer reads.                                                              |
|   2 | Native custom end marker in supporting browsers             | Firefox capability found; not integrated. Preserve first-client/SSR determinism and verify actual boundary/affix behavior.                                         |
|   3 | Native `maxHeight`/custom multiline marker from future CSS  | Current tested engines lack draft syntax; monitor actual implementations.                                                                                          |
|   4 | Native-only entry or optional omission of exact state       | Contract/packaging choice. Can remove code or measurement only by narrowing promised behavior.                                                                     |
|   5 | Defer plain segmentation until failed full fit              | Not integrated; isolate full-fit state from boundary rank and measure common short-fit sources.                                                                    |
|   6 | Defer Rich searchable cuts until failed full fit            | Not integrated; support inspection remains mandatory.                                                                                                              |
|   7 | Share bounded identical plain preparation                   | Positive source-update evidence; implement with miss, boundary, size and retention controls.                                                                       |
|   8 | Larger source-preparation LRU / cross-family pool           | Not justified by the one-entry experiment. Measure reuse distance and retain only pure data.                                                                       |
|   9 | Compact Rich point representation                           | Positive preparation/allocation mechanism; lazy consumers and heap/E2E evidence still needed.                                                                      |
|  10 | Lazy word-mode grapheme fallback                            | Positive when unused, substantial fallback penalty; conditional integration experiment.                                                                            |
|  11 | Lazy/chunked segmentation, suffix-first offsets             | Not integrated. Full-fit and start/middle paths need different metadata; do not assume end-prefix laziness generalizes.                                            |
|  12 | Unicode/WASM/manual segmenter replacement                   | A distinct correctness/bytes/browser-version burden; native ASCII fast path is already retained. Profile before replacing Intl.                                    |
|  13 | Typed boundary arrays                                       | Previously tested and rejected in research 315; worker transfer is a different potential purpose, not a retry of the same speed claim.                             |
|  14 | Preparation in a worker                                     | Contract/latency trade-off: main-thread responsiveness can improve, but cloning/startup/cancellation and synchronous settlement must be addressed.                 |
|  15 | Incremental preparation after source edits                  | Not integrated. Unicode boundaries can cross an edit seam; preserve exact contextual segmentation and bound retained history.                                      |
|  16 | Paid width interpolation                                    | Tested; mixed probe results, no broad replacement.                                                                                                                 |
|  17 | Per-glyph Range source-position hint                        | Tested; query overhead usually outweighs saved fit probes.                                                                                                         |
|  18 | Collapsed caret / hit-test source hint                      | Not tested; separately gate bidi, whitespace, offscreen/occluded content and marker reshaping.                                                                     |
|  19 | More adaptive warm policy / learned width history           | Existing guarded slopes/local search already cover part of this. New policies need structural and A/A wins, not better synthetic prediction alone.                 |
|  20 | Consecutive/eager candidate deduplication                   | Consecutive reuse tested without material gains; eager normalization adds work and must preserve rank semantics.                                                   |
|  21 | Nonmonotonic candidate specialization                       | Correctness first; descending joining-script path is retained. A shorter search requires a demonstrated safe property, not capped lookahead.                       |
|  22 | Canvas/OffscreenCanvas typography hints                     | Existing opt-in Pretext is the retained route. Browser DOM verification/eligibility cannot be dropped for default accuracy.                                        |
|  23 | Parallel candidate clones / extra Rich inspection tree      | Prior connected-tree prototypes change selector/layout context. A new isolation proof is required before timing matters.                                           |
|  24 | Shared measured resize delivery                             | Retained in 325–327; important baseline, not a new result of this investigation.                                                                                   |
|  25 | Shared font frames and native event delivery                | Positive flush evidence for Line/Inline/Wrap; modest/uncertain total-time benefits and lifecycle gates.                                                            |
|  26 | Representative-first candidate cohorts                      | Tested with own-DOM verification; no general win. Expensive, poorly predicted cohorts remain an open specialization.                                               |
|  27 | Broaden Rich batching into full/source/font cases           | Structural candidates remain excluded. Text-only Rich could be a narrower future experiment; do not generalize to inline element trees.                            |
|  28 | Broaden batching to stylesheet-defined widths               | Not integrated. A resolved pixel width does not prove content independence; consider an explicit independence contract instead of a huge CSS fingerprint.          |
|  29 | Share candidate strings or pure search-cost decisions       | Not integrated; small CPU-only ceiling. Profile after larger layout/preparation costs are removed.                                                                 |
|  30 | Detached Rich suffix pool                                   | Different from rejected connected hidden tails. Low measured clone-call ceiling, extra retained DOM, source/image lifecycle and GC need evidence first.            |
|  31 | Reuse live computed-style wrappers                          | Tested, flat; no need to retain it now.                                                                                                                            |
|  32 | Cache resolved style values or verified layout answers      | Prior failures/invalidations remain. No complete width/font/class/ancestor fingerprint has been demonstrated.                                                      |
|  33 | Rich patch unification / alternate Range operations         | Existing changed-suffix patching retained; prior delete/unification experiments increased mutation work. New representation must show a specific benefit.          |
|  34 | Layout containment, Shadow DOM, hidden suffix CSS tricks    | Alter current CSS context or structure. Application/contract direction, not a default shortcut.                                                                    |
|  35 | Wrap verified geometric growth beyond initial cap           | Positive dense-growth evidence; preserve ordinary/dynamic-after controls and fresh commits.                                                                        |
|  36 | Wrap bounded first materialization                          | Not integrated. Could avoid mounting huge unused suffixes, but changes initial full-item/slot lifecycle and intersects SSR/hydration.                              |
|  37 | Static-after Wrap solver                                    | Requires a proven static slot contract; current dynamic-after settlement cannot trust a measured past size alone.                                                  |
|  38 | Cached item-slot VNodes / computed item bodies              | Not integrated; reactive dependency propagation alone does not cover arbitrary owner rerenders. Prove invalidation, or make stability explicit.                    |
|  39 | One child component per Wrap item                           | Previously rejected: stale layout-dependent slot behavior plus higher mounting cost (research 321).                                                                |
|  40 | Item geometry prefix sums / fixed-size declarative mode     | Current verified width hints already cover some cases. Author-provided dimensions/stability could enable more through a new contract.                              |
|  41 | Remove Vue intermediate state/leaf VNode work               | Existing Line/Inline settlement and internal Line leaf memo already address demonstrated waste. Further changes must keep live user slots and nextTick settlement. |
|  42 | Defer offscreen / idle / animation-frame-budgeted work      | Contract: changes result freshness and can expose stale states. Application-level or explicit opt-in.                                                              |
|  43 | Virtualize lists / lazy hydration                           | Application-level wins by avoiding component work; retain as guidance rather than silently omitting requested output.                                              |
|  44 | SSR bootstrap/prepared data/result seeds                    | Research 317 defines the correctness boundary. Server cannot know final client layout; seeds are hints unless the browser measured them.                           |
|  45 | Tree-shaking, native-only packaging, smaller shared helpers | Measure per-component minified gzip and startup separately; source-line counts are not a performance metric.                                                       |
|  46 | Browser-specific low-level layout/platform-font APIs        | DevTools APIs are not deployable web APIs. Extended TextMetrics methods queried here are absent. Do not build a default dependency on them.                        |

## Prioritization and acceptance

Proceed first with the three real-component candidates as independent changes. Wrap has the largest
observed scenario improvement; shared text has the clearest ordinary multilingual source-update
case; font delivery fixes a scheduling gap but should be described in terms of its actual workload
and total-time evidence. Their percentages are not additive and cannot be averaged into a default
upgrade claim.

The next representation experiment should compare deferred full-fit preparation against compact/lazy
Rich cuts, including overflow-heavy and long-token fallback controls. Test worker/offscreen/initial
materialization ideas only as explicitly separate freshness or lifecycle designs. Revisit lower-cost
caches only if profiling after these changes makes them consequential.

Minified ESM delivery, Vue external, gzip level 9 (prototype deltas, not raw TypeScript line counts):

| Prototype                                     | Line gzip delta | Inline gzip delta | Rich gzip delta | Wrap gzip delta | All exports gzip delta |
| --------------------------------------------- | --------------: | ----------------: | --------------: | --------------: | ---------------------: |
| Shared text preparation                       |           +53 B |             +55 B |               0 |               0 |                  +56 B |
| Shared multiline font frame, hardened         |           +89 B |                 0 |           +89 B |               0 |                  +89 B |
| Shared font frame + native delivery, hardened |          +197 B |            +121 B |          +207 B |          +114 B |                 +202 B |
| Wrap geometric continuation                   |               0 |                 0 |               0 |           +46 B |                  +47 B |
| Live computed-style object cache              |               0 |                 0 |           +47 B |               0 |                  +53 B |
| Repeated-candidate verdict                    |           +25 B |             +24 B |               0 |               0 |                  +27 B |

Font byte figures include the cancellation/error-isolation hardening; the earlier counter fixtures
exercise normal nonthrowing delivery. A tiny size delta is not sufficient reason to retain a flat
optimization.

For a production change, require exact current behavior first, then reduced work and repeatable
elapsed-time evidence outside A/A variation in the intended scenario. Include singleton, unique
source, full-fit, expansion/recovery, reactive slot and lifecycle controls. For sharing, record the
retained data limit and keep layout ownership local. For batching, inspect layout duration and writes
alongside layout count. Keep timing limitations explicit instead of using a microbenchmark or a
pathological case as a release-wide headline.

## Reproduction notes

The three independent experimental diffs are retained in
[`328-prototypes/shared-text.patch`](./328-prototypes/shared-text.patch),
[`328-prototypes/font-delivery.patch`](./328-prototypes/font-delivery.patch), and
[`328-prototypes/wrap-growth.patch`](./328-prototypes/wrap-growth.patch). They are unapplied research
artifacts, not production-ready commits. Each is relative to the research 327 snapshot; that
snapshot's built `dist/index.js` SHA-256 is
`fdde6fd3d358db4054d34ae0abd6fa89c1679ca89e78b57326b6b87db770e38d`.

Local experiment runners/results live under `/tmp/vue-clamp-exploration-328/`; they are intentionally
not runtime package changes. `baseline/` is a snapshot of the research 327 source and built entries.
`compare-variants.mjs` builds production-Vue scenarios from those entries; its dimensions are
`TARGETS`, `SCENARIOS`, `COUNTS`, `ROUNDS`, `STEPS`, `METRICS`, and `RESULT_NAME`.
`compare-native-font.mjs` adds trusted FontFace events, `compare-wrap-heldout.mjs` adds dense held-out
fixtures and frame settlement, and `compare-cache-controls.mjs` adds 10,000-unit cache-miss inputs.
`mechanisms.mjs` runs the browser helper-level alternatives described above. The fixture definitions,
probe counts, algorithm distinctions and measurement boundaries in this document are the durable
record; temporary logs and raw command transcripts are not repository artifacts.
