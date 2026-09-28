# Measured search, rank domains and DOM traversal

This audit starts from `1e34d28`, after research 339 and the 1.6 release comparison in research 340.
Its baseline is the current 1.7 development package, not npm 1.6.0. Five small runtime changes survive
the renewed search, information-acquisition, preparation and traversal experiments. None changes
the public API or the native clamp paths.

## Retained changes

### Reuse identical marked text within one solve

Word-end and following-space ranks can render the same trimmed text. The previous candidate could
already avoid a consecutive write, but a failed string could be revisited after a different fitting
string, requiring another write, layout and restoration. `searchTextCandidates` now retains the
latest fitting and failing strings for that solve. It compares strings it already constructs;
there is no extra boundary scan or cache shared across components or reclamps.

For a fixed string predicate, replaying a cached verdict gives the generator the same boolean as
the original query. Induction over generator steps therefore preserves the answer and leaves an
ordered subsequence of its original queries. This equivalence does not require monotonic fit:
Arabic/Syriac descending searches retain the same answers too. It does require stable geometry
during that solve, as does the existing candidate search. It is not an identity for arbitrary CSS
or a license to reuse an earlier reclamp's verdict.

Bare full source retains its independent verification, even if its string equals a marked
candidate. Recursive word-to-grapheme fallback starts a new verdict scope. The component still
applies the final result when the last measured DOM contains another candidate.

### Map paid Inline width through unequal word lengths

An eligible failed full-body read already supplies a width ratio. Multiplying that ratio by the
number of word boundaries treats a long word, a short word, whitespace and an emoji segment as
equal units. Inline now converts the ratio into a UTF-16 source-length budget, then binary-maps
that budget to legal primary word cuts for the requested prefix/suffix ratio.

This is only a starting estimate. UTF-16 length is not glyph width, the marker is not free, and
actual browser search still decides the result. Grapheme and word-fallback domains retain their
previous rank-density estimate. Split Inline still measures full-body width to remove fixed affix
occupancy. Full-fit sources still return before this preparation is consumed.

The restriction to paid full-width information is deliberate. Applying source-length projection
to partial-text resize history made ordinary Inline resize slower and increased its layout count
from 41 to 52. Multiline source-length seeding improved a long CJK source update by about 20%, but
a held-out long-leading-word source regressed by 39.8% [36.5%, 43.3%], with 132 → 216 layouts.
That multiline version is rejected. Line packing slack and unbreakable words prevent one global
length-density rule from replacing both models.

### Project primary Rich grapheme ranks as well as word ranks

Rich already has logical runs and an ordered primary boundary-point view. The view and returned
primary rank are now available for grapheme mode too. A text-safe rank can seed the first resize
from retained rank/width density, then use the existing observed rank movement when available.
The projected point maps through that exact primary point view.

Word-mode fallback remains separate: a cut absent from the primary word point set returns no
primary rank. Atomic endpoints, whitespace adjacent to atomics, current computed-style inspection,
affix compatibility and same-run refinement retain their existing handling. No new historical
rank can certify today's fit.

This changes the choice of the initial marked point. It does not change the separate full-source
fit-order gate or its verification. The 32 px bootstrap fallback therefore remains for that gate
when the observed word-slope path is unavailable, and for rankless starting hints. It is an
empirical policy, not a proved optimum or a bound on possible rank movement.

### Keep ordered fit scans linear

`countLineBoxes` already avoids a quadratic representative scan for ordinary ordered fragments.
The same shortcut now applies to `fitsContent`, including combined line and height constraints.
A rectangle either matches the last representative or starts more than half a pixel below the
largest representative top; the latter cannot match any earlier representative. Every other
case retains the original scan and half-pixel top/bottom comparison.

Ordinary ordered lists take linear work. Unordered and overlapping lists preserve the original
semantics and may still require quadratic work. Height clipping and early overflow exit are
unchanged. A seeded overlapping/unordered oracle checks both line counts and height bounds;
4,000 ordered fragments also have an operation-count bound, independent of machine timing.

The isolated 500-line/20,000 px-height, 2 px-wide, 6,000-unit CJK source case reduced task time by
27.7% [-28.5%, -26.9%] while retaining 48 layouts over six updates. This is a deliberately extreme
large-line-limit workload, not a typical three-line component claim.

### Walk Wrap element siblings directly

Sequence measurement, materialized-item collection and visible atomic-height measurement now walk
`firstElementChild` / `nextElementSibling`, preserving the same component-owned part filtering and
early exits. They do not retain a child collection across Vue updates. This removes collection
iteration overhead without changing which boxes are read or materialized.

The isolated twelve-instance tiny-item resize case reduced task time by 3.5% [-5.2%, -2.3%]; A/A
was +0.05%, and both packages performed 353 layouts. The ordinary Wrap row improved by 5.5%
[-7.9%, -2.6%]. Height, item-update and source-trigger controls did not establish an elapsed-time
change. Wrapper style objects were already shared; caller slot VNodes and current geometry remain
live costs.

## What the resize experiments establish

A scalar pixel threshold collapses several different decisions: whether bare full source needs
measurement, where marked search should start, how far to expand locally, and whether already
measured information can remove a query. These decisions have different evidence and costs.

Even for a fixed monotonic predicate, an expected-cost optimum needs a distribution of answers
and a cost for changing from the currently displayed candidate to each query. A suitable state
includes the remaining answer set, the displayed string or rich structure, and whether bare full
source is known to overflow. With those specified, the decision-tree recurrence is:

`V(state) = min_query(cost(state, query) + Σ_outcome P(outcome | state, query) × V(next_state))`

The terminal cost must include restoring the final display. A different answer distribution,
patch origin or layout cost can change the minimizing query without changing the width delta.
Balanced binary search gives the familiar threshold-query bound under equal costs and a minimax
objective; it does not minimize browser task time with clean/dirty reads and structural patches.
An algorithm fitted to one observed width trajectory is not an oracle for unseen text and CSS.

This audit recorded 360 marked monotonic browser search traces across sixteen Line/Inline shapes
and 24 width steps. Replay first reproduced the original primitive's full query path, then kept
the current anchor filtering. These are modeled rank queries, not another browser timing run:

| Local search policy                         |  Modeled marked reads |
| ------------------------------------------- | --------------------: |
| Current component-specific expansion limits |                 1,079 |
| Three local expansions                      |                 1,048 |
| Four local expansions                       |                 1,036 |
| Five or unlimited local expansions          |                 1,030 |
| Superexponential step variants              |                 1,038 |
| Galloping factor four                       |                 1,095 |
| Galloping factor eight                      |                 1,185 |
| Cauchy-centered pivots, scales 0.5 / 1 / 4  | 1,111 / 1,115 / 1,307 |

The best aggregate saving here is only 4.5%, and individual traces can regress. The trace totals
do not price candidate bytes, compulsory full-source probes or adversarial large prediction errors.
They do not justify changing the default expansion limits globally.

Two browser-backed adaptive alternatives were also tested:

- Nearest lower/upper width-history interpolation reduced random Inline layouts from 81 to 55,
  but added a grapheme layout (45 → 46), and its elapsed-time interval included zero with a large
  A/A movement. It remains an unproven specialist predictor.
- Choosing the next expansion budget from the previous measured rank error reduced random Inline
  layouts from 81 to 75, but left nearly every other measured scenario's layout count unchanged.
  The extra metadata did not establish a broad improvement over the current small local budget.

The retained steps instead reuse exact information and correct the rank space in which estimates
are made. This is a narrower claim than having discovered a universal optimal resize threshold.

## Rejected acquisition and preparation paths

The earlier research ledger was treated as evidence, not an exclusion list. These prototypes were
rebuilt and compared against the same frozen baseline:

| Experiment                                                          | New evidence and decision                                                                                                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-layout caret hit testing                                       | The batching-correct variant still slowed Latin source updates by 6.1% [5.2%, 7.3%] without reducing their 96 layouts. Rejected.                                                                                        |
| Collapsed Range queries before marked search                        | CJK layouts fell 198 → 48 and time fell about 21%, but sparse-source time increased 3.8% [2.2%, 6.5%]. Additional clean queries have a cost; the generic route is rejected.                                             |
| Source-length seeding for Line and for warm partial text            | CJK and emoji wins did not survive the multiline long-leading-word and ordinary warm controls. Only the full-width Inline application is retained.                                                                      |
| Deferred Rich fallback preparation through shared text preparations | CJK source updates regressed by 9.6% [9.3%, 10.1%]; larger Latin and fallback-heavy controls did not establish a compensating broad win. This prototype is rejected, without excluding a different lazy representation. |
| Rich direct reverse point indexes                                   | Layout counts stayed equal; timing intervals were mostly inconclusive and retained metadata/payload grew. Rejected.                                                                                                     |
| Larger, probabilistic and previous-error local expansion policies   | Replay and browser results were distribution-sensitive; retain current default limits.                                                                                                                                  |

An earlier standalone text experiment compared hit testing and collapsed Range queries over 120
fixtures. Its fixed order and included setup made its elapsed times diagnostic only. Production
package comparisons, including their counterexamples, determined the decisions above.

## Measurement method and final package evidence

The production driver imports the frozen before package, the final package, and a duplicate before
control in one browser process. It rotates target order, excludes one warmup round, and requires
exact settled output equality across all targets and rounds. Timing runs do not overlap builds,
tests, CPU profiles or bootstrap summarization. The ordinary width path is
`280,260,220,180,250,330,300,190,360,240,320,210`; the random path is
`1200,45,89,817,444,111,301,322,66,707,344,999`. Tiny Wrap uses its separate dense-list width path.

The main rows use twelve instances and twelve updates; singleton rows remain separate. Source
rows generally use 6,000 UTF-16 units when named `large`, with instance-distinct sources where
specified. Primary word mode is the default measured fixture; Rich grapheme-affix rows explicitly
force measured behavior. Native controls retain their actual default native eligibility.

`TaskDuration` is the Chromium CDP browser-task total, including settlement/output capture. It is
not paint time. Percentages use the geometric mean of paired candidate/before ratios; 95% intervals
use 10,000 paired bootstrap resamples. A/A is a drift diagnostic, not a value to subtract from the
candidate. Do not combine scenarios into a page score or infer real application trigger frequency.
Mount rows have warm imports/fonts and fresh component instances; they are not cold navigation or
network benchmarks. Font rows change CSS metrics and dispatch a synthetic font-completion event.

Final comparisons use Chromium 151.0.7922.34. The frozen bundle hashes are
`f1986de36e040a0c744d7999762f59012b641c2299862d73c5258e43f55c0f08` (before) and
`b9cb642b42b2c659003e5c80cd7a3282f433cad6c18c5ae9b84eb6637af83a0e` (final).

Eight measured rounds per main/singleton scenario follow the warmup. The table records the
entire main cohort, including unchanged work and unfavorable/inconclusive timing rows. Negative
task change means less time. Layout counts cover the whole twelve-update sequence.

| Twelve-instance scenario               | Layouts before → final | Task change, 95% interval | A/A task change |
| -------------------------------------- | ---------------------: | ------------------------: | --------------: |
| `resize-line`                          |                49 → 43 |     -9.0% [-20.2%, +0.6%] |           +0.3% |
| `resize-line-affix`                    |                50 → 46 |     -7.1% [-20.2%, +4.5%] |           +6.5% |
| `resize-line-height`                   |                47 → 39 |    -11.2% [-26.6%, +4.9%] |           -9.0% |
| `resize-line-random`                   |                80 → 76 |      +0.2% [-4.9%, +6.6%] |           -6.8% |
| `resize-line-jitter`                   |                41 → 41 |    +12.9% [+0.6%, +25.9%] |           +3.2% |
| `resize-inline`                        |                41 → 39 |      -1.4% [-7.4%, +6.0%] |           -1.5% |
| `resize-inline-cjk`                    |                40 → 40 |     +3.0% [-5.9%, +15.7%] |           +8.2% |
| `resize-inline-auto`                   |              604 → 580 |    +2.7% [-12.0%, +18.6%] |           -2.4% |
| `resize-inline-random`                 |                81 → 73 |    +15.1% [-4.1%, +43.6%] |          +10.3% |
| `resize-rich-plain-grapheme-affix`     |              271 → 241 |   -14.9% [-19.1%, -10.3%] |           +2.1% |
| `resize-rich-nested-grapheme-affix`    |             1172 → 930 |      -8.0% [-9.3%, -6.6%] |           +0.5% |
| `resize-rich-plain-cjk-grapheme-affix` |              250 → 211 |   -31.7% [-33.4%, -29.0%] |           +0.6% |
| `resize-rich-nested-atomic`            |              575 → 576 |      +1.5% [-2.3%, +6.2%] |           -1.0% |
| `font-rich-metrics`                    |            1596 → 1596 |     -6.7% [-13.4%, -0.0%] |           +0.6% |
| `source-inline-emoji-large-distinct`   |               168 → 60 |   -27.4% [-28.1%, -26.8%] |           -0.2% |
| `source-inline-skewhead-large-end`     |               120 → 60 |     -8.3% [-11.1%, -5.6%] |           -1.3% |
| `source-line-cjk-large-distinct`       |              198 → 198 |      -0.6% [-1.3%, +0.2%] |           -0.4% |
| `source-rich-cjk-large-distinct`       |            1359 → 1359 |      +0.5% [-0.5%, +1.5%] |           +0.1% |
| `resize-wrap`                          |                74 → 74 |      -1.7% [-6.2%, +3.1%] |           -0.2% |
| `resize-wrap-tiny`                     |              353 → 353 |      -2.9% [-4.4%, -1.7%] |           -0.3% |
| `resize-wrap-height`                   |              150 → 150 |      -2.8% [-8.7%, +2.7%] |           -2.8% |
| `item-wrap`                            |                96 → 96 |      -1.4% [-3.1%, +0.2%] |           +2.4% |

The small-jitter Line row initially regressed despite identical layout counts. An isolated
sixteen-round repeat measured +1.3% [-4.8%, +8.1%], with A/A +5.2%; it did not reproduce a
stable regression or establish a gain. In that repeat ordinary Line was -6.0% [-11.0%, -0.2%],
with A/A -4.1%, and random Inline was -1.5% [-12.0%, +8.4%]. Reduced Line/Inline layout counts
are consistent; broad elapsed-time claims for ordinary text resize are not established.

Rich nested atomic resize adds one layout (575 → 576) in this fixture, with an inconclusive
time change. The separate required eighteen-scenario Rich matrix passes every configured
structural counter comparison at zero tolerance. Neither result implies universal dominance.

Singleton resize intervals are mostly inconclusive, including the Rich grapheme and Wrap rows.
Long emoji Inline source updates improve by 11.7% [-17.1%, -5.9%], with 168 → 60 layouts.
Native Line/Inline controls retain twelve layouts per twelve width updates. Arabic/Syriac
controls preserve output and layout counts, with no established timing change.

The final large-line-limit case improves by 28.3% [-30.4%, -26.4%], with 48 → 48 layouts.
Fresh long-emoji Inline mounts improve by 22.3% [-29.0%, -16.2%] for one instance and 27.9%
[-31.6%, -24.0%] for twelve, using 14 → 5 and 27 → 9 layouts respectively. These six-round
mount comparisons retain their warm-import/font scope; short full-fit, native Line and measured
Rich mount controls do not establish elapsed-time changes.

## Delivery cost and correctness

These are minified, tree-shaken single-entry bundles with Vue external, gzip level nine. Shared
chunks are bundled together before compression; per-component sizes must not be added together.

| Import              | Before gzip bytes | Final gzip bytes |        Change |
| ------------------- | ----------------: | ---------------: | ------------: |
| LineClamp           |            11,337 |           11,430 |           +93 |
| InlineClamp         |             7,408 |            7,606 |          +198 |
| RichLineClamp       |            15,405 |           15,445 |           +40 |
| WrapClamp           |             6,211 |            6,234 |           +23 |
| All root components |            26,608 |           26,827 | +219 (+0.82%) |

Formatting, lint and type checks pass, as do 111 unit tests, all 414 Chromium browser tests, and
282 focused Firefox/WebKit tests. Cross-engine coverage includes the new Rich rank mapping and
warm-versus-fresh width/font cases, text fit/fallback/full recovery, Inline, width sweeps, layout
clipping and Wrap. Package and website builds pass.

The original rank-cost browser test now uses distinct marked strings so the abstract rank-query
count remains an exact assertion. Word-string verdict reuse has its own regression; bare full
source still has a separate-check regression. Existing independent enumeration and fallback-domain
cases remain active. The eighteen-scenario required Rich matrix covers unfamiliar jitter, varied
line capacities, long tokens, class/dynamic atomics, affixes, height clipping and full recovery.

A separate finite model compares the frozen and final Text generators over 18,432
configurations: word/grapheme boundaries, four location ratios, both spacing modes, independent
cursive flags, optional full candidates, several hints, monotonic length predicates and arbitrary
fixed string predicates. All answers match; final queries are subsequences of the original queries,
removing 15,370 modeled reads in total. These are synthetic configurations, not browser
layouts or a population-weighted performance estimate.

The first three-sample whole-JS-heap diagnostic showed 243,156 → 311,964 retained bytes for twelve
nested grapheme Rich instances, while post-unmount deltas also differed substantially. After six
additional warmup cycles per target and five samples, retained medians were 249,772 → 245,772 bytes;
the duplicate baseline was 235,308. Singleton medians were 40,676 → 38,560, with a 41,280 control.
Twelve-instance DOM/listener counters matched at 451 nodes and 18 listeners, and warm post-unmount
deltas were 2,164 / 5,196 / 384 bytes for before/final/control. The initial heap increase is not a
stable per-instance attribution. These process-level samples include runtime/cache effects and do
not prove either memory savings or leak absence. Rank views remain bounded by the current instance's
logical runs; the Text verdict strings remain local to one solve.

The final archive contains the main cohort, singleton, cursive, large-line-limit, mount, initial
heap, isolated jitter review and warmed-heap runs, with identical package fingerprints throughout.

## Remaining cost centers and boundaries

A separate 250 µs CPU-sampling pass over the baseline localized current work; these profiles are
not timing comparisons. Line/Inline resize samples concentrate in browser geometry and Vue/style
work. Long CJK source updates additionally spend substantial time in native segmentation. Nested
Rich pays for geometry, current style inspection and structural DOM work. Dense Wrap spends most
active samples in style patching, geometry, sequence measurement and caller item rendering; child
collection was a smaller but removable part.

The Rich lazy-preparation and reverse-index results prevent attributing those source costs to an
obvious universally profitable replacement. Reusing arbitrary caller slots, retaining connected
rich suffixes, worker/offscreen measurement or bounded initial rendering still needs a sound
freshness/lifecycle or public-contract design. Source-only width estimates cannot recover arbitrary
font shaping, line packing, pseudo occupancy or container-dependent styles.

The ordinary marked search retains its established conditional monotonicity assumptions; joining
scripts retain descending evaluation. No complete CSS fingerprint, cross-reclamp answer cache,
new scheduling behavior or global optimality claim is introduced. Local experiment snapshots,
drivers, raw rows and hashes follow the repository's ignored evidence convention; this report and
`design.md` retain the decisions, workload definitions and material counterexamples.
