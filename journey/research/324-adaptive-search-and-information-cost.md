# Adaptive search and the cost of information

## Objective and current status

The next optimization objective is the total cost of reaching a valid, maximally retained output,
including acquiring information, choosing candidates, patching, browser layout, and amortizing
preparation across future updates. A dynamically calculated pixel window is only one possible
policy. It is not the objective itself.

This audit adds algorithm and browser mechanism experiments. It does **not** adopt a new runtime
search, a cross-instance scheduler, or an authoritative result cache. The existing implementation
and the published-version measurements in research 322/323 remain separate baselines. The subsequent
implementation, eligibility restrictions, and real-component E2E results are recorded in
[research 325](325-measured-text-layout-batching.md).

## Fixed parameters still present

| Owner                         | Parameter                                                                     | Role                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rich component                | `warmBootstrapWidthDelta = 32`                                                | Hint/bootstrap and full-precheck policy before usable word-rank slope evidence |
| Shared search                 | Two local expansions; three for Rich and Line word search                     | Bounds speculative local probing before binary fallback                        |
| Text layout                   | Widths within a factor of two                                                 | Restricts extrapolation scale                                                  |
| Text, Inline, Rich cold hints | More than 16 candidates; multiline full content at least three times capacity | Chooses whether to seed search with a proportional estimate                    |
| Wrap materialization          | Fallback 32 items; cap based on 48 items per line                             | Limits speculative item rendering, with settlement fallback                    |

These are different from storage bounds and numerical tolerances. For example, Inline's 0.5px
comparison tolerance accompanies an integer `scrollWidth` measurement. Removing every constant
would conflate numerical representation, resource limits, and empirical search decisions.

The current text/Rich cost helper accurately counts probes **conditional on a supplied target
rank**. The supplied rank is still estimated from measured history or rank density. It is not a
proved bound on the next layout's result. The stronger interval model in `tests/search-model.ts`
is not the production decision rule. Model accuracy and input certainty must be reported separately.

## The decision problem

For a layout state `x`, candidate `k`, browser fit predicate `F`, and a nonempty feasible set,
the desired result is:

```text
T(x) = max { k : F(k, x) }
```

The existing marker-only fallback and full-source candidate remain explicit semantic cases.
Measuring the candidate must include its actual marker, affixes, shaping, wrapping, and height
constraints. Character count times average glyph width is not that measurement.

A policy chooses both which information to acquire and which candidate to try. A useful total-cost
formulation over the lifetime of reusable layout information is:

```text
minimize E[ preparation + sum(update decision + patch + layout + scheduling) ]
subject to the output/visibility contract and a retained-memory bound
```

For an observation state `S`, a conceptual Bellman equation is:

```text
V(S) = min over legal actions a:
       cost(a, S) + E[ V(next(S, a, observation)) ]
```

State includes the remaining candidate uncertainty, current DOM patch origin, layout invalidation,
and reusable information. Actions include a fit query, a geometry query, preparing an index,
continuing local search, bisecting a verified interval, or batching independent queries. A stop
action is legal only when the required result is established.

This is a definition of the optimization problem, not a proposal to ship a large dynamic-programming
solver. A practical policy needs a small approximation whose own CPU and memory costs are included.
Expected-cost optimality needs a workload model; minimax optimality instead protects the worst case.
The two can choose different queries. Complete deterministic layout inputs determine an answer,
but a previous width, rank, and slope do not uniquely determine the next answer.

## Search algebra experiment

The actual `findLastFittingIndex` primitive was compared with unlimited exponential expansion and
a prototype that clips preferred queries to splits feasible within the cold minimax probe budget.
The latter was exhaustively checked for candidate counts 1–128, all valid hints, and all monotonic
targets: 715,520 combinations returned the correct target within `ceil(log2(N + 1))` probes.

That worst-case guarantee has an opportunity cost. For 4,096 candidates and hint 2,000:

| True target movement | Cold binary | Current two expansions | Three expansions | Unlimited expansion | Cold-budget prototype |
| -------------------- | ----------: | ---------------------: | ---------------: | ------------------: | --------------------: |
| 0                    |          12 |                      2 |                2 |                   2 |                     8 |
| +3                   |          12 |                     14 |                6 |                   6 |                    13 |
| +7                   |          12 |                     14 |               15 |                   8 |                    13 |
| +1,000               |          12 |                     14 |               15 |                  20 |                    13 |

These are exact **primitive query counts**, not the public component's selected path or timings.
They expose a discontinuity introduced by the fixed expansion cap, but also show why simply
removing that cap is not a universal improvement. The minimax prototype demonstrates a different
trade-off; it is not the best possible expected-cost tree.

Without information about likely targets, no query near the old answer can simultaneously preserve
all of a balanced tree's worst-case budget and all nearby targets' cheap proof paths. Future work
should compare complete policies, including hint selection, rather than tune expansion counts alone.

## Exactness finding: candidate rank is not always monotonic

The monotonic-predicate premise itself requires qualification. A Chromium experiment measured
complete candidate strings under a fixed `16px Arial` single-line layout, including the marker,
for Latin, unequal-width Latin, CJK, Arabic, and emoji; start, middle, and end truncation were
included. Width-table predictions agreed with the actual `scrollWidth` predicate in 28,224 checks
over 32 fractional container widths. This is a controlled fixture, not a general CSS proof.

Arabic end and middle candidates contained width decreases as more graphemes were retained. This
also reproduced against the **built InlineClamp component**, not only a synthetic search model:

```text
text: نحتاج إلى الاحتفاظ بالنص المناسب أثناء تغيير عرض الحاوية باستمرار
location: middle
font: 16px Arial, sans-serif
line-height: 24px
width: 188px
```

The component returned the 31-grapheme candidate while an exhaustive browser check found that 34 fit. The
33-grapheme candidate's intrinsic width was 192.1875px; the 34-grapheme candidate was 187.453125px.
Thus a rejected next candidate did not prove that all later candidates failed. Other observed
counterexamples occurred around 247–249px. The result depends on the rendered font environment.

This is an under-retention finding, not a reported overflow. Merely measuring every _visited_
candidate does not establish global maximality when unvisited candidates can fit. A fixed lookahead
of another two or three characters would be another heuristic, not a general repair.

CSS Text specifies context-dependent shaping and language-dependent line breaking. CSSOM Range
rectangles describe the selected portion of the current layout, not the independently reshaped
candidate after truncation. Consequently, widths of isolated glyphs or slices of the uncut source
cannot generally substitute for complete rendered candidate widths.

Sources: [CSS Text](https://www.w3.org/TR/css-text-3/#shaping),
[CSSOM View Range geometry](https://www.w3.org/TR/cssom-view-1/#dom-range-getclientrects).

This finding makes an audit of maximality across shaping-sensitive candidates a prerequisite for
claiming a universally exact adaptive search. Existing monotonic search proofs remain conditional
on that premise; the current runtime has not been repaired by this research-only change.

## Candidate width indexes: precision versus acquisition cost

For a constrained single-line layout with width-independent typography and occupancy, each complete
candidate has a measured required width `R[k]`. A width update then asks for the largest `k` with
`R[k] <= availableWidth`, using the actual predicate's numerical convention.

This does not require candidate widths to be monotonic. A suffix-minimum envelope
`B[k] = min(R[j] for j >= k)` is monotonic; the last `k` whose envelope fits is the last fitting
candidate. This can support a compact breakpoint index after all relevant widths are known.
Skipping unmeasured later candidates still needs proof. Measuring only `k` and `k + 1` is insufficient
for the Arabic counterexample.

Acquiring all widths has a cost. A separate single-instance browser experiment compared the actual
warm-search primitive against eager candidate-width preparation plus one live verification per
update. It used plain Latin, middle truncation, fixed Arial typography, and the same deterministic
width sequence. Both strategies returned identical outputs. It does not include Vue, component
policy gates, style/font invalidation, or affix behavior.

| Source length | Resize count | Warm reads | Prepared-index reads | Warm median | Index median, including preparation |
| ------------- | -----------: | ---------: | -------------------: | ----------: | ----------------------------------: |
| 128           |            8 |         78 |                  137 |      0.7 ms |                              1.2 ms |
| 128           |          128 |      1,289 |                  257 |     12.0 ms |                              2.6 ms |
| 512           |            8 |         96 |                  521 |      1.0 ms |                              7.5 ms |
| 512           |          128 |      1,562 |                  641 |     15.5 ms |                              8.4 ms |

The experiment alternated strategy order for seven rounds and discarded the first round. Timings
are small, instrumented mechanism diagnostics, not a package speedup or a statistically established
gain. Candidate-string preparation was common and excluded; index acquisition was included.
The prototype queried the measured table by descending scan; a breakpoint index was not timed.

If extra preparation costs `P`, expected future saves per valid update are `s`, and `H` updates
remain before invalidation, preparation is worthwhile only when `H * s > P`, including maintenance
and retained-memory costs. For uncertain inputs, the more general criterion is positive expected
value of information: reduced future decision cost must exceed acquisition cost. Historical width
volatility and font/content churn affect this decision alongside text length, line count, and font.

This is not a proposed new constant such as “prepare after 64 resizes.” A lazy index can acquire
only information that current probes already pay for, then selectively expand if measured reuse
justifies it. A correctness-preserving fallback remains necessary while the index is incomplete.
The useful horizon ends when typography, content, relevant CSS, or affix geometry changes.
Width-dependent CSS can invalidate even a geometrically convincing old breakpoint.

## Scheduling changes the cost of a probe

A second independent mechanism experiment used 48 plain single-line DOM instances and eight width
changes. Both strategies used the same binary search, candidate sequence per instance, final
outputs, 3,204 geometry reads, and 3,444 text writes. The serial strategy alternated each write/read;
the batched strategy wrote one candidate for every active instance before reading any of them.

| Metric                             | Serial search | Batched search rounds |
| ---------------------------------- | ------------: | --------------------: |
| Chromium layout count              |         3,205 |                    68 |
| Chromium style-recalculation count |         3,205 |                    68 |
| Median browser layout duration     |      39.24 ms |              14.17 ms |
| Median synchronous task duration   |       46.8 ms |               17.8 ms |

Seven rounds alternated order and discarded the first; Chromium Performance metrics and logical
read/write counters were collected separately. This is a DOM mechanism experiment, **not a measured
improvement to Vue Clamp**. It demonstrates why equal geometry-call counts need not imply equal
browser layout cost. Fewer layout passes still process all affected content; layout work does not
disappear in proportion to pass count.

This differs from the rejected shared ResizeObserver hub, which still completed each component's
write/read search serially. A real batched solver would need resumable fit queries, explicit barriers,
and preserved same-flush/before-paint settlement. Reactive affixes, root changes, user-visible slot
execution, cancellation, and Wrap's intermediate Vue commits make integration nontrivial. A page
with only one active clamp cannot receive the same cross-instance benefit.

## Exploration space and priority

| Direction                                | Information or work it changes                            | Main constraint                                                      |
| ---------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Browser-native mode                      | Removes the JavaScript solver                             | Must represent the requested public semantics                        |
| Verified bounds and adaptive query trees | Chooses the next candidate from current evidence          | Maximality premise; probe and patch cost differ                      |
| Learned target distribution              | Improves expected candidate order using paid observations | Distribution drift; predictions must not authorize output            |
| Lazy candidate-width/breakpoint index    | Reuses geometric facts across widths                      | Acquisition, shaping, invalidation, and bounded storage              |
| Browser line-break mapping               | Seeks more information from one paid layout               | Source-boundary mapping and reshaping after inserting the marker     |
| Pretext or another layout model          | Moves work from DOM layout to reusable preparation        | CSS/font accuracy scope and delivery cost                            |
| Batched fit-query rounds                 | Amortizes layout flushes across independent instances     | Scheduling and reactive/DOM ownership contracts                      |
| Wrap item materialization policy         | Trades rendered unknown items against future settlement   | Arbitrary slot costs and geometry; no free knowledge of hidden items |
| Explicit stable-layout contract          | Makes more information safely reusable                    | Product/API change must be intentional                               |

The next priority is to separate feasible-output correctness from maximal-retention correctness,
then evaluate batched queries and lazy single-line geometry indexes in narrow real-component
prototypes. Adaptive warm policy should be evaluated against both exact target traces and actual
patch/layout costs, including the cost of acquiring its inputs. No global pixel window, full width
table, or learned predictor should be adopted solely because it improves a focused probe count.
