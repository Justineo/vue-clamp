# Measured resize search and renewed performance audit

The release-to-current comparison, representative workloads and delivery-cost reflection are
recorded in [research 340](340-release-1.6-performance-reflection.md). This report retains its
internal-baseline measurements; their percentages are not 1.6.0 upgrade gains.

## Resize search: optimize information acquisition, not a pixel cutoff

No policy is uniformly best across target distributions and cost objectives.
A width change predicts neither the exact retained rank nor the cost of patching to it. The old gate
estimated the rank change, then evaluated a warm tree starting at the old rank as if that estimate
were the answer. Its complete cost also depended on whether bare full text was measured afterward.
Correcting the cost accounting alone did not establish a better policy: the isolated height row
regressed by 8.7%. Cost-model agreement is necessary for that model, but it does not make its target
estimate true.

The replacement separates three kinds of information:

- Compatible primary-domain overflow history determines whether the separate bare-full probe can
  be omitted under the existing fixed-geometry and width-monotonic assumptions. Same-width and
  unknown-growth solves, fallback history, and split Inline measure it; Line retains its separately
  guarded full-fit-on-grow path.
- An eligible paid full-layout sample supplies a fresh starting estimate. Otherwise prior
  retained density projects a pivot into the current width. This is only a guess; Line rounds and
  Inline ceilings as an empirical choice supported by the measured workloads. Exact-width Inline history stays
  a pivot only.
- The currently rendered marked candidate can be checked before replacing it with bare full text.
  Its fresh answer eliminates implied marked queries from the original projected search tree. This
  preserves that tree and removes only implied queries, instead of rebasing its binary interval, which can create
  extra dirty reads by changing midpoints.

The browser still decides candidate fit. The unmarked source is not an ordinary endpoint in the
marked candidate ordering: a long ellipsis can make a shorter marked candidate wider than full text.
Arabic/Syriac keep the existing descending search because contextual joining violates the marked
monotonicity premise. The new filtering claim is conditional on the same monotonic marked ordering
already used by the ordinary binary search; it does not establish that arbitrary CSS is monotonic.

For the same starting candidate, final answer, fixed monotonic predicate, pivot and underlying
generator, filtering retains an ordered subsequence of marked probes. This component's candidate
string transitions and reads following those transitions cannot increase. Acquiring an anchor may
add one read without a preceding candidate write by this component; “clean” does not mean the browser
cannot flush width, style or peer work. This does not bound cross-instance layout passes, patched
bytes or elapsed cost. The unmarked source retains its independent check.

Production-helper checks cover 580,448 synthetic ordinary configurations (ranks 1–32, every
hint/anchor/target, independent full-source verdict, default expansion budget, end/trim/fixed marker)
and 11,440 synthetic nonmonotonic fit sets with the cursive flag. They are finite model checks, not
that many real browser layouts. A rebased-domain alternative had an extra-dirty-read counterexample
and was rejected. Pre-full ordering restores the measured fractional/jitter baseline layout counts
that a post-full anchor lost.

## Correctness limits exposed by optimization

A typography change invalidates width-based overflow evidence, including simultaneous shrinking
of both the font and container. In the reproduced case, bare source shrank to 252 px inside 288 px,
while the longest marked candidate was 324 px; old Line and Inline stayed truncated. Current
computed typography and line breaking now invalidate measured history, and font events clear width evidence
when computed font CSS itself does not change. Independent split affixes can change occupancy
without changing body typography, so split Inline measures bare full text on each solve.

The metric key is an invalidation aid, not a complete CSS-environment identity or an answer cache.
It covers the tested text properties, including maxHeight paths that previously bypassed this check.
All final results still follow the component's established measured settlement.

An unchanged typography key also misses independently changing pseudo occupancy. A focused
primary-grapheme Inline case uses twelve `W` characters and `..`: shrinking from 154 px to
120.0234 px while removing 43.5781 px of `body::before` occupancy makes bare full text fit, while
the largest marked candidate still fails. The baseline's warm probes happened to visit ranks
9, 10, then bare-full rank 12; the marked-only replacement stopped at rank 10. This is outside the
fixed-geometry premise, but removing that full endpoint caused a real observable regression.

After initially omitting full measurement, Line and Inline now recheck bare source when the latest
hint and result share boundary offsets and either the root strictly shrank while kept count grew,
or the result reached the largest marked rank. The first condition detects evidence contradicting
the previous width observation; the second preserves the old full endpoint even when kept count
does not change. A failed recovery restores the completed search's marked output and starts overflow
history at the current width. The isolated candidate recovered full source in the reproduced case,
matching both fresh cold output and independent DOM enumeration. Six permanent cases cover both
runtime paths, successful recovery, failed-full restoration followed by growth, and the unchanged
maximal marked endpoint. These two guards do not
establish a complete identity for arbitrary CSS changes.

## Search evidence and what “optimal” means

The old threshold combined two decisions: whether to restore and measure bare source, and where to
start marked search. Those decisions need different evidence. A predicted rank cannot establish that
the source overflows, and an observed overflow does not establish the next retained rank. Correcting
the old complete probe cost was useful as a diagnostic, but preserving that gate would still price
the wrong starting position once search uses the projected rank.

The finite search study compared local budgets, directional first probes, width-density pivots,
rounding, jitter dead bands, rebased anchor intervals, and anchor filtering. Replaying 216 actual
browser search traces reproduced the primitive's original path. Replay retained the original full-precheck/final-full decisions. Four identifiable paid Line seeds
were preserved; equal-rank paid seeds could not be distinguished from history in the trace format.
Under that approximation, rounded projection modeled 780 probes versus 1,296; ceiling produced 753
but increased dirty reads
in a Line jitter trace. Thus a smaller aggregate probe count alone did not choose the final policy.
The retained component-specific rounding comes from browser comparisons, not a theorem about the
next layout. Dead bands recovered jitter but added six probes and four dirty reads in an Inline
sweep counterexample. Filtering fresh evidence kept the prediction's tree without that trade-off.

An expected-cost optimum needs a target-rank distribution and costs for clean reads, dirty reads,
candidate patches and completion. A minimax policy instead needs a defined answer set and legal
queries. For N+1 possible monotonic cut positions, balanced binary search attains the unit-cost
threshold-query lower bound of ceil(log2(N+1)); this is not a browser-time or DOM-write bound. Local
search may be much cheaper for a concentrated target distribution, and a clean query about the
already-rendered candidate has a different cost from a destructive full-source probe. The retained
algorithm improves acquisition and reuse of current information without claiming to infer missing
line-break physics. Its proved query-filter property is narrower and stronger than a benchmark-only
claim that one cutoff is best.

## Word fallback has a different authority boundary

The previous matcher rejected grapheme fallback offsets, leaving width-based fallback-domain reuse
unreachable. Simply accepting those offsets exposed two problems. Fallback kept counts cannot be
compared against the primary word count, and a historical no-word-fit result cannot decide today's
search domain when independent occupancy changes.

An Inline counterexample changes `body::before` from 200 px to zero while shrinking the root from
320 px to 300 px. The body typography key stays the same. Experimental activation of the fallback-domain cache incorrectly
keeps part of a second word; current primary-word enumeration keeps only the first word. A permanent single-word
regression also verifies recovery of bare full source when pseudo occupancy disappears.
The final design removes `wordFallbackMaxWidth`. Fallback hints never authorize skipping the full
source, and multiple words retry primary word cuts before fallback.

Overflow bounds must also stay within the same boundary-offset domain. A three-step Inline
regression first forces grapheme fallback with pseudo occupancy, removes that occupancy while
shrinking to a width that fits only the first word, then grows enough for full text while staying
below the initial width. Before the fix, the primary result inherited the fallback's
`clampedMaxWidth`, so the last step retained the first word and marker while a fresh mount fit the
full source. Inline now filters the metric hint by boundary-offset identity, matching Line; returning
to primary cuts starts its overflow bound from the current measurement. The new test failed before
the fix and passed afterward: Chromium passed all 13 fallback cases, and Firefox and WebKit each
passed the new case. These focused counts are separate from final integration coverage.

For one primary word, excluding bare full source leaves only primary marked rank zero. Its answer
cannot change the subsequent grapheme fallback, so that probe is unnecessary. The helper's 123,840
finite configurations cover ASCII lengths 1–40, ratios 0/0.5/1, independent full verdicts and
absent/word/fallback/stale hints; some configurations repeat equivalent inputs. They preserve output
and subsequent queries; when full source is included, the original
query sequence is retained. Permanent browser cases exercise genuine unbroken ASCII words with
`overflow-wrap:anywhere`, full-fit recovery, current word preference, font/source/ratio changes,
split affixes, and independent enumeration. The original generic “longword” fixture used repeated
emoji, whose word segmentation does not prove coverage of this path.

## Other cost centers

Retained runtime changes:

- Ordinary mounts ignore an already fulfilled font-ready promise while preserving pending readiness,
  loading completion, cancellation, error isolation and reentrant subscription. Predictor-bearing
  Line still invalidates shared metrics when remounting or reactivating after a font change.
- Line uses current text typography for invalidation, including maxHeight. Its capacity estimate
  reuses the same computed line-height. A synchronous observer snapshot reuses the target's style
  for writing mode and its own transform check, eliminating one redundant wrapper acquisition.
- Rich can cut backward into an earlier text leaf while preserving preceding live nodes and its root
  marker. Primary-word rank projection maps through the correct primary point array; fallback ranks
  remain a distinct domain. The old rank-cost gate no longer discards that projected starting point;
  observed-slope, text-rank safety and current-DOM verification still apply.
- Wrap uses midpoint-first search when the materialized interval has at most one interior count.
  Wider intervals propose a frontier from the failing upper candidate and check its successor.
  Both routes still verify the committed sequence and before-affix geometry. Its after-affix flow
  model reserves the final row's affix width in one pass instead of repeatedly simulating prefixes.

Each live font listener group shares a cancellable set for its current pending readiness promise.
Unsubscription removes the callback from both readiness and loading-event delivery; resolution
clears the pending set, and the final subscriber detaches the event listener. Pretext preserves its
existing fulfilled-ready invalidation because shared predictor metrics can survive inactive gaps.
Its native promise reaction remains activity-guarded until readiness settles. Computed typography
keys and same-call observer-style reuse do not retain computed-style objects across deliveries.

The final font refinement keeps only Line's current marked semantic rank after font delivery.
It deletes `rootWidth` and `clampedMaxWidth`, discards full-fit hints, and preserves fit-cache and
predictor invalidation. The current DOM can then supply a fresh anchor before the required bare-full
read; the retained rank cannot authorize either overflow reuse or full-fit-on-grow reuse.

Against the combined package, a 12-round, 20-instance ablation reduces Line's event-only layouts
48→36. TaskDuration is -5.45% with a -14.24% to +6.58% interval, so the reason to retain it is less
layout work, without a demonstrated elapsed speedup. Eight fixtures across six font/resize actions,
both packages and three engines produce 288 matching comparisons against fresh mounts, with a
current bare-full fit read after every action. These use a real URL font and explicit notification
dispatch; native event capability is checked separately.
The final Line-only package is `8beb9ee739db5029664285710d4bc979e032e96433202e5ebcc3889fbac29924`.
Eight focused regressions per engine cover the change, including the permanent negative control:
the old displayed prefix was left three times per event versus once after refinement, while the
required full check remains.
The real URL-font shrink plus width 220→218 still restores bare source.

Inline retains full invalidation after a font notification. Preserving a semantic anchor while
preferring the current full-density pivot did not reduce its event-only layouts. Letting the old
semantic rank take precedence did reduce them 48→36, with -6.06% paired task work (-9.84% to
-1.63%) against the Line-only combined package, though A/A also shifted -3.62%. It reduced
unbroken-word layouts 72→60 without an established elapsed gain. Actual font-resource changes
exposed the opposite cost: fixed-width narrow/wide URL-font swaps increased first-delivery fit
reads from 3 to as many as 10 while both outputs remained clamped at positive complete-word cuts.
All 342 safety/resource comparisons still matched fresh mounts. Correctness alone did not justify
that runtime trade-off, so the Inline extension was rejected. Later repeated notifications could
be cheap and must not hide the expensive first resource-change solve.

The ordinary Inline trace explains the tension. Its current rank is 8 and still fits, but paid
full density predicts 10. That tree measures failing ranks 10 and 9; starting at the verified rank
8 needs only the failing successor 9. Simply raising a density estimate below a fitting anchor
would not help because 10 is already above 8. Conversely, a large real glyph-width change makes
the old rank a poor starting point. Neither observation establishes a universal rank or pixel cutoff; the
retained policy favors current full-layout information for Inline font invalidation.

Cross-engine validation also exposed pre-existing WebKit test limitations. This runner loads and
renders local and URL fonts but omits native `loadingdone` in the independently tested paths. The
real-delivery test verifies the URL font's rendered width change, then dynamically skips only when
that WebKit capability is absent; Chromium and Firefox verify the trusted event and callback.
Loading a local face before adding it to the font set also leaves reused canvas metrics stale in
both baseline and candidate. The permanent lifecycle cases instead load a repository-owned URL
font after adding it to the set, preserving actual font-change assertions. The CJK `keep-all` case
checks the documented valid, contained word-prefix contract; exact agreement with measured search
was an excessive requirement for the opt-in predictor. Other exact-DOM comparisons remain.
Independent platform probes reproduced these limitations in both baseline and candidate.

The Wrap base case follows the discrete search domain. In the mixed-width fixture, the first grow
searches [3, 27], where upper/frontier probing saves three reads. Learned widths later restore 19
items and leave [19, 21], where checking only 20 can reject growth in one read. Unconditional
upper-first added one read on each of five later grows: for 20 instances, the initial 60-layout
saving became a net 40-layout increase. The terminal guard preserves the first saving without
those later upper probes. It is not universal dominance: an upper endpoint that fits can favor
upper-first even in a two-count interval. Fixed-pixel browser regression and negative-control
coverage preserve this workload distinction.

The fixed-after model matched 12,000 seeded cases and reduced pure width accesses from 509,384 to
43,782. Actual after-slot comparisons kept layout counts and output identical and did not establish
an elapsed-time gain. This is a smaller calculation, not a separate runtime speed claim.

The retained Rich selection matched three browser engines over 432 warm and 90 cold comparisons
per engine, including 18 actual font-size/family changes, empty markers, long-word fallback, atomic
affixes and height-only content. Each engine exercised 330 projections, 189 crossing leaves,
75 rankless outcomes and 22 backward leaf moves. Rebuilding the oracle source reproduced the
fingerprint of the timed `rich-projected-open` package. The earlier backward-plus-projection package,
with the cost gate still present, estimated nested resize task work at -9.98% (95% CI -12.21% to
-8.16%) and nested atomic work at -9.25% (-11.39% to -6.92%), with A/A near -0.7%. Plain Rich was
neutral. The event-only font rows in that comparison do not establish font-swap performance.

The final gate decision uses ten affected and held-out scenarios from the required matrix, with
16 instances, eight samples and a duplicate baseline. These measurements use package `activeMs`
with counter tracking disabled; they are distinct from CDP TaskDuration and paint time. Removing
the cost gate from the same backward-plus-projection package produced:

| Scenario                      | Active-time change | 95% paired interval |
| ----------------------------- | -----------------: | ------------------: |
| Tight-font long-token jumps   |             -6.35% |    -7.27% to -5.28% |
| Long-token affix grow-to-full |            -24.04% |  -25.52% to -22.32% |
| Word height-card jumps        |            -24.36% |  -31.71% to -16.88% |
| Long-token novel jitter       |             -1.58% |    -2.66% to -0.42% |

No reliable reverse regression was established against the gated package. This is not a claim
that every Rich workload improves: word-copy novel jitter, one-line copy jumps and CJK jitter have
baseline A/A estimates of +3.02%, +10.06% and +6.91%, respectively. Their original-baseline timing
differences cannot establish an optimization effect.

The required Rich matrix exposes trade-offs. In the one-line word-copy jump case, projected bbox
reads fell 2,352→2,064 while rect entries rose 1,776→2,112. Backward prefix preservation also replaces
some child-list mutations with character-data mutations. Accordingly the structural comparison tool
remains a required diagnostic, but componentwise counter dominance is no longer treated as a
necessary scalar cost model. The 18-scenario instrumented matrix preserves these increases; its two
samples per target establish structure, not elapsed performance. The separate eight-sample timing
comparison above supplies the evidence for accepting the trade-off.

Wrap's faithful table fixture includes actual before/after slots and stable arrays. Its ordinary
height cases combine maxLines=2 and maxHeight=60; the 1,000-item tiny-height case is maxHeight-only.
The original generic “affix” scenarios did not render affixes and cannot support that claim. Initial
dense timing also included Vite console forwarding of ResizeObserver errors; that run is excluded
from final timing claims. A repeat disables console forwarding and records native window errors.
Separate eight-extra-frame diagnostics found no output changes or extra item-slot calls after each
recorded transition; requested widths were the actual root widths. This establishes settlement for
these fixtures, not a universal explanation for ResizeObserver warnings.

## Combined measurements and the final font refinement

Five runs contain 1,440 raw rows for package `508ca67aa43fcb01f17d9c182012bd9bcc24eb13fd4748ebd37b3a1cfb7a6005` against the
`c764480` baseline package. Driver and built-JavaScript fingerprints are recorded; the control
imports the exact baseline entry. These Chromium 149 measurements cover the recorded fixtures,
not other engines or a universal workload distribution. Settled markup matched across targets.
This package precedes the final Line-only font callback refinement; that refinement changes no
other component or search code. Its separate final-package follow-up is recorded below.

The main and faithful Wrap runs use 20 instances, 12 updates, eight measured rounds, a discarded
warmup and rotated target order. Changes below are paired geometric-mean CDP TaskDuration ratios
with 95% bootstrap intervals; layout counts are sample medians for the whole update sequence.
TaskDuration includes settlement and output capture, not paint time. Representative main results:

| Scenario                  | Task change | 95% paired interval | Layout count |
| ------------------------- | ----------: | ------------------: | -----------: |
| Line resize               |     -21.65% |  -27.43% to -15.37% |        81→49 |
| Line resize with affix    |     -24.16% |  -27.11% to -20.83% |        86→50 |
| Line CJK resize           |     -42.81% |  -43.72% to -41.98% |       106→51 |
| Line unbroken-word resize |     -29.69% |  -32.17% to -27.35% |       155→75 |
| Inline CJK resize         |     -24.26% |  -29.72% to -18.84% |        93→40 |
| Rich nested resize        |     -30.53% |  -31.19% to -29.90% |    1,427→806 |
| Rich nested atomic resize |     -22.71% |  -24.79% to -20.41% |    1,676→943 |
| Rich plain resize         |     -18.62% |  -22.65% to -13.98% |      320→285 |

Sparse-uncertain source updates reduced task work by 12.54% for Line (interval -13.39% to -11.93%),
9.94% for Inline (-10.58% to -9.25%) and 9.34% for Rich (-9.65% to -9.01%), with unchanged layout
counts. Large ordinary/full-fit Line source updates, huge Rich updates and the curly/CJK controls
did not establish time savings. The emoji Inline source row has a +0.39% candidate estimate and
+0.34% A/A estimate with unchanged layouts; that small positive difference is not sufficient to
attribute a regression to the candidate.

The Line resize row has a -4.50% A/A shift, smaller than its candidate change. Initial Line jitter
has large baseline drift: the candidate is -3.79% (-15.16% to +10.89%), while identical baseline
copies differ by -12.26% (-20.96% to -0.52%). A separate 16-round repeat restores comparable
baselines: at 20 instances candidate and A/A are both +1.45%, with intervals crossing zero. At
one and four instances the candidate estimates are +1.93% and +4.60%, also inconclusive; all
layout counts remain 41→41. The repeat does not establish a jitter speedup or regression, and
does not erase the earlier drift. The repeat contains 144 samples. Line height and ordinary,
long-word and random Inline resize rows likewise
have intervals crossing zero despite some lower layout counts.

Before the final Line refinement, event-only Line and Inline layouts both increased 36→48.
The final package was therefore measured separately against the original baseline in twelve rounds
with 20 instances and 12 updates, producing 288 rows for the final `8beb9ee` package:

| Scenario                              | Task change | 95% paired interval | Layout count |
| ------------------------------------- | ----------: | ------------------: | -----------: |
| Line font notification                |      -0.02% |    -5.02% to +5.22% |        36→36 |
| Inline font notification              |     +15.52% |  +11.73% to +19.35% |        36→48 |
| Line font-size change                 |     -10.90% |   -16.56% to -5.47% |       108→54 |
| Inline font-size change               |      -8.66% |   -13.51% to -4.14% |        90→66 |
| Height-limited Line font notification |      +4.31% |    +0.08% to +9.10% |        36→36 |
| Height-limited Line font-size change  |     -10.89% |   -18.89% to -2.17% |        84→54 |

The Inline event-only increase is an explicit cost of discarding stale font measurements; its A/A
estimate is -2.60% with an interval crossing zero. Height-limited Line has a smaller positive task
estimate despite unchanged layouts, with A/A +1.06% and a wider interval crossing zero. The figures
do not support a general font-event speedup. These notifications are synthetic `loadingdone`;
font-size rows also change actual CSS metrics, and none measures font-download time. Genuine
resource-change correctness and the rejected Inline rank trade-off are recorded separately above.

Two non-font controls in the final-package run retain the earlier structural results: ordinary
Line resize is -17.20% (-21.35% to -13.12%), with layouts 81→49 and A/A +3.07%; jitter keeps 41
layouts and has an inconclusive +5.55% estimate with A/A +2.39%. The final callback refinement
changes no other component or search code, and the earlier bulk rows retain their own fingerprint.

The final Wrap terminal guard resolves the earlier mixed-width extra-read path:

| Scenario                      | Task change | 95% paired interval | Layout count |
| ----------------------------- | ----------: | ------------------: | -----------: |
| Mixed widths                  |      -3.47% |    -4.56% to -2.31% |      224→164 |
| Height limit                  |     -14.04% |  -17.53% to -10.68% |      504→144 |
| Before affix and height limit |     -13.15% |  -15.40% to -11.03% |      504→164 |
| Dense height-only list        |     -18.04% |  -18.31% to -17.83% |  2,202→1,582 |

Ordinary Wrap growth and after-slot rows retain their layout counts and have timing intervals
crossing zero. Every target/round has identical item, before and after slot-call counts. Native
window-error capture records 12 ResizeObserver warnings per sample for ordinary growth, mixed
widths and after slots, and six for the other rows, identically across all targets. The 1,458 total
includes warmup; other errors are zero and console forwarding is disabled. The separate Playwright
warning columns are zero, so the native listener supplies these counts. The final dense count is
1,582, not the earlier unconditional-upper variant's 1,462: the discrete guard trades some dense
upper-probe savings for avoiding repeated mixed-width work.

Small-cohort and mount results remain separate. In six-sample resize runs, ordinary Line improves
by 11.85% at one instance and 18.27% at four; unbroken-word Line improves by 20.40% and 24.84%.
Most small Inline/Wrap time estimates remain inconclusive. The one-instance Rich row also has
14.42% A/A drift, limiting its timing interpretation despite fewer layouts. In six-sample mount
runs, no singleton interval excludes zero. At 80 instances, Inline, Rich and Wrap task estimates
are -18.70%, -22.88% and -15.31%, with intervals below zero. Line has no established mount gain:
its 20-instance +6.21% estimate accompanies +15.48% A/A drift, and its 80-instance interval crosses
zero. Mount rows describe one settled mount, not the 12-update resize workload or first paint.

The heap run has only three post-GC samples at 20 and 80 instances. Mounted node and listener
counts match, but heap deltas do not show uniform improvement. For example, 20-instance Line
mounted-minus-empty medians rise 343,212→376,824 bytes; post-unmount deltas are 3,008→36,112 bytes.
The corresponding 80-instance post-unmount delta is only 840 bytes for the candidate, and the A/A
heap values also vary. These are descriptive process-heap observations, not object attribution,
a leak diagnosis or proof of zero retained memory. No per-scenario speedups are added together.

## Unicode preparation

Retain the prefix-64 hybrid preparation, without expanding the existing whole-source alphabet of
U+0020–U+02FF plus tab/LF. A shared first-unsafe search distinguishes entirely admitted sources from
mixed text. Only mixed sources with an admitted prefix of at least 64 units use the hybrid route.
Long admitted interiors supply direct offsets; uncertain spans retain native grapheme segmentation
with one neighboring admitted unit on each side. Word segmentation still comes from the current
engine and word cuts must also be native grapheme boundaries. Short-prefix sources keep the native
loop, even if a later safe run is long. This narrows the optimization's coverage deliberately.

The unrestricted minimum-2 prototype improved sparse uncertain text but regressed curly-quote
Line/Inline/Rich source updates by 39.47%/37.47%/29.64%. A 64-unit run guard reduced that overhead,
but a per-grapheme iterator-type branch still penalized native fallback inputs. Splitting the native
and numeric loops removed that branch; sharing the prefix scan also avoided a second whole-source
search in inputs that cannot benefit. The linear-run split-loop variant still added roughly 1–3%
in controls and was rejected in favor of prefix admission.

In `VbzD7L`, prefix admission changed sparse-uncertain source-update TaskDuration by -11.33% for
Line (95% CI -11.87% to -10.74%), -10.67% for Inline (-11.32% to -9.99%), and -9.36% for Rich
(-10.30% to -8.49%). Curly Line, pure-CJK Inline, emoji Inline and ASCII Line controls all had
intervals crossing zero and duplicate-baseline estimates near zero. These are source-preparation
workloads, not resize gains, and 64 is a measured throughput guard rather than a universal optimum.

Both final refinements passed Chromium, Firefox and WebKit native oracles over 19,761 strings per
engine. Each target had 79,044 checks across eager/shared word/grapheme preparation, including
fallback arrays and cursive classification. The corpus covers native Unicode vectors, malformed
surrogates, combining marks, Prepend, CRLF, joined pictographs, emoji, Indic and private-use cases,
plus lengths around the admission boundary. It includes 162 inputs where only a later long run
qualifies for the linear variant. The permanent browser regression keeps a small set of these
context cases and compares with each engine's complete-source `Intl.Segmenter` output. The final
integrated preparation block matches the oracle-tested prefix variant apart from formatting.

## Alternatives and scope

The audit also reopened Rich index reuse, projected rich ranks, Wrap after-affix flow modeling,
Unicode preparation, font-ready delivery, computed-style wrapper acquisition, measurement queues,
native completion geometry, and per-instance/shared ownership. Previously recorded stop advice was
not used as an exclusion rule. Only candidates with current implementation evidence and an adequate
benefit/cost balance were retained. Existing SSR, accessibility, freshness, passive-rich-content,
slot execution and native-mode contracts remain constraints on optimizations. Offscreen deferral,
workers, canvas-only fitting, changed first-render limits and generic containment did not establish
those contracts in the considered variants. Other formulations require separate evidence or a
contract decision; their performance potential is not claimed to be exhausted.

Rejected or deferred in this audit:

- Corrected old Text cost gating: insufficient by itself; the isolated height workload regressed.
- Rebased anchor intervals and jitter dead bands: counterexamples add dirty reads.
- Inferring full-source overflow from a short unmarked prefix: this adds a different monotonicity
  premise. A static font-width countermodel has `f=600`, `…=200`, and an `ffi` ligature of 500 units.
  At width 1,000, marked candidates `…`, `f…`, `ff…` have widths 200/800/1,400 and are monotonic,
  while unmarked `ff` overflows and full `ffi` fits. This all-Latin example needs no CSS or history
  change and is not excluded by the cursive guard. It is a logical countermodel, not an additional
  browser-font experiment. The independent full-source check remains necessary without a stronger
  font/shaping contract, even where laying out long source text is expensive.
- Reusing immutable Rich index data during every refresh: no sufficient broad timing benefit.
- A live computed-style WeakMap: valid in three browsers after correcting read-order bias, but no
  established broad speedup to justify persistent state.
- In-place queue compaction: 2.028 microseconds versus 1.963 baseline and 1.933 A/A in the CPU screen.
- Skipping native completion geometry or sharing observer ancestry state across callbacks: no valid
  freshness proof in the presence of completion hooks or intervening writes.
- Unrestricted hybrid Unicode segmentation: sparse-emoji Latin improved, but curly punctuation,
  CJK and emoji controls regressed. The linear-run admission refinements retained control overhead;
  only the separately verified prefix-64 refinement was adopted.

## Measurement discipline

Baseline is `c764480`. Built package variants are isolated and fingerprinted. Browser task timings
use production Vue, one warmup, rotated target order, and duplicate-baseline A/A controls. The main
update comparisons use 20 instances and 12 updates per sample, normally eight measured rounds.
TaskDuration includes output capture; it is neither paint time nor the deliberate quiet-frame wall
wait. Output equality is checked for every recorded settled update. Source updates, font events,
mounts, native controls, singleton cohorts and rich markup are separate workloads.

Paired percentage summaries use the geometric mean of per-round ratios and 10,000 seeded
bootstrap resamples. A/A drift and confidence intervals limit small claims. The separate
18-scenario Rich structural matrix has only two samples per target and does not establish time
savings. No isolated speedup is added to another to predict combined performance. Raw samples,
intermediate patches and one-off experiment scripts are local artifacts excluded from Git; this
report preserves the design decisions, comparison methods and observed trade-offs.

## Bundle and validation costs

Identical production minification and tree shaking, with Vue external, give the following gzip
sizes. These are application import bundles, not package tarball sizes. The combined entry grows
by 151 bytes; Inline's independent import grows by 565 bytes, including the current-metric and
full-source recovery checks. This is an explicit size cost of the retained behavior.

| Import                     | Baseline gzip bytes | Combined gzip bytes | Change |
| -------------------------- | ------------------: | ------------------: | -----: |
| All four components        |              26,515 |              26,666 |   +151 |
| LineClamp                  |              11,677 |              11,389 |   −288 |
| InlineClamp                |               6,843 |               7,408 |   +565 |
| RichLineClamp              |              15,267 |              15,394 |   +127 |
| WrapClamp                  |               5,995 |               6,234 |   +239 |
| Optional Pretext LineClamp |              31,451 |              31,154 |   −297 |

Permanent regression tests cover full-source recovery, font invalidation, fallback-rank domains,
Unicode preparation and Wrap frontier search. Cross-engine verification includes Chromium, Firefox
and WebKit; the native font-event capability limitation is described above. Correctness checks are
separate from timing evidence and do not imply a speedup.

The instrumented package smoke first covered all 152 scenarios. After the final Line/Inline
full-source recovery changes, all 71 text scenarios were rerun against combined package `508ca67`:
50 Line and 21 Inline, with two successful samples per target/scenario. Rich and Wrap source did
not change between those matrix stages.
The subsequent Line-only font callback refinement uses the separate final font/update comparison
and final test suites above; these earlier matrix rows retain their original fingerprints. These
runs establish execution coverage and structural counts; completion does not itself prove
output equality or an elapsed-time improvement.
