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

Those checks must remain invariant across browser hosts with different installed fallback fonts.
Exact ranks, whether an already-narrow interval needs one more unit of scalar credit, and fixed
probe-count ceilings are font-metric outcomes rather than portable contracts. The retained tests
therefore compare interval/credit ordering and search complexity, use the bounds returned by the
paid fit probe when calibrating packing slack, and keep observed widths clearly inside an
algebraic threshold because Chromium quantizes layout to a subpixel grid.

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

The production warm-cost check counts probes by running `findLastFittingIndex` itself against a
synthetic monotonic target predicate. It does not maintain a second handwritten simulation of the
grow, shrink, expansion-limit, and binary-fallback control flow. Exhaustive unit coverage compares
the model and real probe count across candidate counts, target ranks, hints, and expansion budgets,
so later search changes cannot silently leave the cost gate behind.

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

The final runtime treats every delivered font-readiness event as a conservative invalidation. A
next-frame pass is skipped only when another width/prop/slot/observer reclamp already measured the
current font in that frame. The earlier family-list and outer-layout-signature proof was removed:
it optimized generic and unused-font synthetic rows, but could not completely represent inherited,
cross-origin, fallback-font, or container-dependent layout.

### LineClamp

LineClamp keeps:

- measured boundary hints that may seed search but never prove the final result
- a narrow grow-only full-text reuse path when a previous full result, unchanged line metrics, no
  affixes, and no max-height clipping make horizontal text wrapping monotonic
- simple-height fitting after exact rect calibration of observed line-box height and line pitch
- same-width font-shrink recovery through mandatory final full-candidate verification; the former
  numeric font-scale precheck was removed as duplicate policy

### RichLineClamp

RichLineClamp keeps:

- all-text structural reuse; element-bearing content restores the full probe and reinspects local
  computed styles on every reclamp
- hidden-probe measurement so visible rich content is not mutated during search
- prefix-preserving rich patch paths for width-only visible updates
- duplicate fit-result reuse inside one clamp pass when the hidden probe is already at the same
  candidate state
- observed word-rank slope as a guarded warm-search hint when source, layout, direction, and
  candidate-geometry identities remain compatible
- same-text-run refinement when an internal text cut proves the adjacent boundary does not fit

Rich source wrappers remain intact in the hidden probe. There is no normalized source/probe text
map, stylesheet scan, or authoritative final-result cache.

## Pre-reliability Matrix Result

The result below records the warm-search phase before the later reliability audit. It is retained
as historical evidence for the search model, not as the current branch-versus-`main` headline.
Current runtime rules and final comparisons are recorded in `journey/design.md` and
`313-clamp-reliability-audit.md`.

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

## Convergence Audit

Three final ablations tested whether the retained warm-search machinery still paid for its size:

- Replacing the duplicated production probe-count simulator with the real search implementation
  reduced the built runtime by 1.10 kB raw / 0.11 kB gzip. Exhaustive search tests passed, and a
  same-process five-scenario comparison kept every structural counter identical. A counters-off
  three-hotspot follow-up moved the aggregate median from 452.5 ms to 431.8 ms; the timing change is
  noisy, so the accepted claim is deletion and drift prevention, not a new speed headline.
- Removing Rich's observed rank slope saved 2.68 kB raw / 0.63 kB gzip, but failed held-out rows. In
  the long-token batch-jump row, active time moved from 209.2 ms to 290.3 ms, bounding-box reads from
  2,928 to 4,560, client-rect entries from 6,144 to 24,160, and mutations from 28,224 to 30,960.
  The slope remains worth its cost.
- Disabling Rich's same-text-run refinement increased client-rect calls from 5,120 to 6,560,
  entries from 12,768 to 18,160, and mutations from 34,144 to 38,672 in the continuous
  metadata-affix row. The code is retained because it buys lower browser work in compatible text
  runs; unsupported and novel-run shapes continue through the measured fallback.

These ablations set the balancing point: remove duplicated proof machinery, but keep guarded Rich
predictors that demonstrate material held-out reductions in expensive layout and mutation work.

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
