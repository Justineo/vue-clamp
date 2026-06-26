# Warm Search Cost Model

## Purpose

LineClamp, InlineClamp, and RichLineClamp historically used small fixed local width windows, such as
`32px`, to decide when a previous clamp result could seed a warm search. This branch keeps those
windows only as conservative bootstraps. They are not treated as globally optimal thresholds.

A replacement rule must start from observable layout inputs and a cost inequality. It must predict
when warm search is cheaper before aggregate benchmark results are read, and it must fail closed
when the runtime cannot observe the physical inputs needed for that prediction.

## Search Algebra

For a prepared candidate set with `N` searchable ranks, the browser fit predicate is monotonic:

```text
F(k) = true  for k <= T
F(k) = false for k > T
```

`T` is the true largest fitting rank for the current layout. Cold binary search and warm search are
deterministic once `N`, previous hint rank `h`, expansion limit `L`, and target rank `T` are known.

The proof model in `packages/vue-clamp/tests/search-model.ts` provides:

- exact cold and warm probe-count estimators
- `estimateTargetRankInterval`, which bounds target-rank movement from width delta, visible line
  capacity, candidate advance, packing slack, and rank count
- `estimateWarmColdProbeCost`, which compares worst warm cost with best cold cost across a target
  interval
- `warmSearchDecision`, which returns the cost pair, whether warm is accepted, and the minimum
  whole-probe-equivalent credit required for ambiguous intervals
- helpers that map accepted rank room back to width room only when the physical inputs are known

The production rule is deliberately strict:

```text
choose warm only when
  warm worst-case layout-probe cost < cold best-case layout-probe cost
or
  layout-probe costs tie and patch-vector evidence is non-worse for warm
or
  an independently measured scalar patch credit covers the probe gap
```

Patch locality can break ties. It cannot justify extra layout probes unless a separate calibration
converts the patch saving into a conservative probe-equivalent credit.

## Physical Inputs

The model treats these as first-class inputs:

- boundary density: grapheme, word, CJK, emoji, long tokens
- visible capacity: `maxLines`, `maxHeight`, line height, and font metrics
- width direction: grow, shrink, same-width invalidation
- candidate advance: adjacent rendered-candidate width deltas, not isolated glyph widths
- packing slack: unused capacity across the allowed visible lines when it can be observed
- affix occupancy and slot geometry
- rich layout shape: text runs, transparent wrappers, atomic inline runs, and max-height clipping
- patch family: same state, same text cut, whole-prefix growth/shrink, full-to-clamped, and
  clamped-to-full

When any required input is missing, the model widens the target interval instead of substituting an
empirical threshold. That is the model-level equivalent of falling back to the safer search path.

## Why Fixed Windows Are Not Enough

The search tests include fixed-window counterexamples. Holding `N = 64`, hint rank `16`, and
previous width `200px` fixed:

- low-density text can move one rank inside a `32px` window, so warm search wins
- high-density text can move many ranks inside the same window, so warm search can lose
- low-density text can move one rank just outside the window, so a fixed window rejects a warm path
  that the rank model still proves cheaper

Line count matters because it changes the slope of target rank versus width. More visible lines can
let the same width delta admit more boundary ranks, but long-token inputs can remain nearly flat.
Line count is therefore a model input, not a standalone switch.

## Browser Calibration

Browser tests check the model before aggregate benchmark timing is considered evidence.

Search-level tests cover:

- exact cold and warm probe orders
- interval-based warm/cold decisions
- whole-probe credit required for ambiguous intervals
- patch-vector tie-break boundaries
- width-room derivation from candidate advance, direction, line capacity, and packing slack

Text layout tests cover:

- actual LineClamp-style target-rank movement
- boundary-density and line-count effects
- CJK, emoji, affix, and max-height inputs
- fit-cost classes: simple height, exact rect-list line counting, and max-height visible bounds
- probe mutation shape during real text layout search
- negative evidence that text candidate widths alone are not a complete line-break model

Rich browser tests cover:

- rich target-rank movement under line count and boundary density changes
- rich patch-family mutation vectors
- actual rich search probe costs with layout, style, clone, and mutation counters from test-side DOM
  method instrumentation
- ranked rich candidate bounds and line-box slack by reconstructing rank states in tests, without a
  retained runtime fit-probe observer
- one-line and multi-line affix slack calibration
- negative multi-line shrink evidence where line-count overflow is the missing observable
- fallback-aware mixed rich rank as diagnostic evidence, not as a retained runtime slope

## Retained Runtime Rules

### Shared Warm Search

Text and Rich runtime decisions use the narrow target-only helper in
`packages/vue-clamp/src/search.ts`. The richer interval and width-room helpers stay in
`packages/vue-clamp/tests/search-model.ts`, where browser and unit tests prove the model without
adding proof-only APIs to the production source module.

Rich rank-state reconstruction is test evidence, not a runtime observer path. The production
`clampRich` search loop has no fit-probe callback; browser tests rebuild rank candidates explicitly
when they need bounds or line-box slack, and the helper is verified absent from the package output.

### Full-Fit Skips

Shrinking clamped widths can skip the separate full-source precheck by monotonicity. Same-width
recomputes still verify the full candidate because font or layout metrics can change without a
width change. Growing passes can skip final bare-full verification only when a previous clamped
width proves the full source could not fit under the same text/rich source, ellipsis, spacing,
line-limit, max-height, and affix identity.

### Font Events

Generic `document.fonts.loadingdone` events can skip reclamp only when the next-frame layout
signature is unchanged and the component subtree has no unresolved inline font/text-width style.
Loaded FontFace events can also skip when none of the loaded families are used by computed
`font-family` values inside the component root. Used-family events remain conservative while content
is clamped; for currently unclamped content, the full source is visible and an unchanged layout
signature can prove a no-op after font-sensitive state is cleared.

### LineClamp

LineClamp keeps:

- an exact-width result cache for repeated fixed-width reclamps with resolved inline width and font
  metrics
- a narrow grow-only full-text reuse path when a previous full result, unchanged line metrics, no
  affixes, and no max-height clipping make horizontal text wrapping monotonic
- simple-height fitting after exact rect calibration of observed line-box height and line pitch
- same-width font-shrink full recovery when a numeric font-scale condition shows the full candidate
  is plausibly now fitting

### RichLineClamp

RichLineClamp keeps:

- cached rendered-layout inspection and rich search indexes across compatible width-only reclamps
- hidden-probe measurement so visible rich content is not mutated during search
- prefix-preserving rich patch paths for width-only visible updates
- duplicate fit-result reuse inside one clamp pass when the hidden probe is already at the same
  candidate state
- a conservative normalized hidden probe that unwraps only no-attribute inline `span` wrappers whose
  box and text-flow metrics match the parent

Normalized probing changes only hidden measurement DOM. Visible output and public states stay in
source DOM coordinates through an explicit source/probe text-point map. Atomic paths and
style-dependent display or line metrics do not create normalized probes.

## Final Matrix Result

The latest complete package matrix compares `vue-clamp@1.5.1` with the current implementation over
`117/117` scenarios. Total active time moved:

```text
19539.1 ms -> 12954.4 ms (-33.7%)
```

Many active-time rows remain low-confidence, so the stronger evidence is structural:

| Metric              |   `1.5.1` | `current` |    Change |
| ------------------- | --------: | --------: | --------: |
| client rect reads   |  `246879` |   `22075` |  `-91.1%` |
| client rect entries | `1905802` |   `68983` |  `-96.4%` |
| mutation records    | `1469288` |  `473032` |  `-67.8%` |
| style reads         |  `219728` |   `90144` |  `-59.0%` |
| offset reads        | `1366876` |       `0` | `-100.0%` |

By component active time:

| Component       |   Before |    After |   Change |
| --------------- | -------: | -------: | -------: |
| `LineClamp`     | `5949.1` | `3603.5` | `-39.4%` |
| `RichLineClamp` | `8082.9` | `4667.3` | `-42.3%` |
| `InlineClamp`   | `1773.0` | `1294.1` | `-27.0%` |
| `WrapClamp`     | `3734.1` | `3389.6` |  `-9.2%` |

LineClamp and RichLineClamp account for most of the active-time reduction. The remaining same-width
font recovery and used-family rows are correctness-conservative recomputes, not pure performance
regressions: the current implementation performs work needed to restore or verify the correct full
visible state after real font metric changes.

## Benchmark Matrix Changes

The package benchmark matrix now covers input families that were missing from earlier warm-search
evidence:

- novel-width jitter, not only repeated width rings
- CJK, emoji/ZWJ, and RTL/bidi text
- generic same-width font events
- loaded unused and used FontFace events
- same-width affix geometry changes
- nested inline metric changes inside rich markup
- rich atomic and dynamic display wrappers
- max-height-only and mixed max-lines/max-height rich shapes

Benchmark tooling now supports:

- scenario filters from `VUE_CLAMP_BENCH_SCENARIOS`
- required scenario-list files through `VUE_CLAMP_BENCH_SCENARIOS_FILE`
- a structural summary comparison gate for focused and held-out A/B runs
- low-confidence timing markers based on active-time variance and margin-of-error overlap
- structural counters in reports so timing deltas are not interpreted without workload evidence

## Rejected Runtime Directions

These paths are intentionally not retained:

- candidate-width-only dynamic warm thresholds
- broad rank-space replacement of the fixed local bootstrap
- using patch-vector dominance to buy extra layout probes
- broad atomic-rich tie-break guards
- Rich warm-hint disablement
- exact-result cache capacity `64 -> 128`
- LineClamp exact-rect classifier based only on small `rects.length`
- Shell-level layout-signature reuse after exact-width Line hits
- Rich content-level simple-line fit for affix/atomic rows
- Rich hidden probe that preserves wrappers and clears suffix text
- Rich `Range.deleteContents()` suffix removal
- Rich transparent-wrapper text-run splitting
- parent-style caching and builder-shape rewrites in normalized-probe construction
- keeping cache entries across unresolved or used-family font events without an independent metric
  signal

The common failure mode was the same: a candidate reduced one visible counter or helped a focused
row, but failed held-out structural counters, changed search shape, increased mutation work, grew
package size without a workload win, or lacked a correctness proof.

## Future Work Gate

Do not continue by tuning constants. A future performance spike should start only if it adds one of
these missing observables or proofs:

- a line-break or line-count observable that predicts multi-line shrink before choosing warm search
- a scalar patch-credit calibration that safely converts patch-family savings into
  probe-equivalent cost
- a new Rich hidden-probe representation that reduces total mutation work and counters-off active
  time while preserving source/visible DOM semantics
- a broader public behavior contract that makes currently dynamic affix or style cases statically
  knowable

Otherwise the next default work should be maintainability: keep retained helpers direct, remove
obsolete internal compatibility paths, and preserve names only where they encode real invariants.
