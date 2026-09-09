# Research 332 prototypes

These are archived experiments against `d826aa59130bb154ac292defcd66f00f3efa6722`.
Three routes remain integrated; see [research 333](../333-preparation-and-warm-measurement.md).
The expanded grapheme alphabet was subsequently removed; see [research 335](../335-language-independent-grapheme-preparation.md).
The [research report](../332-further-performance-exploration.md) explains eligibility, measurements
and unresolved costs. Apply them only in an isolated checkout.

## Patches

| Patch                     | Scope                                                                             |
| ------------------------- | --------------------------------------------------------------------------------- |
| `unit-graphemes.patch`    | Expand the closed one-unit grapheme alphabet                                      |
| `text-pool.patch`         | Four-entry MRU preparation pool; 8,192 total source units                         |
| `wrap-growth-upper.patch` | Upper-endpoint probe after geometric growth has begun                             |
| `rich-warm.patch`         | Single-text-node warm Rich batching and synchronous status settlement             |
| `combined.patch`          | Exact formatted combination used for the final performance and compatibility runs |
| `line-fit-scan.patch`     | Conditional high-limit fit-loop grouping experiment                               |
| `typed-width.patch`       | Conditional CSS Typed OM eligibility experiment; correctness proof incomplete     |

Each standalone patch applies to the baseline. `combined.patch` replaces the first four patches;
do not apply it on top of them. Prototype names/comments are intentionally preserved from the
experiment; production integration should update the ASCII-specific names in the expanded path.

The four fixture patches independently modify the baseline
`tools/benchmark/scripts/measure-update-costs.mjs`. Do not stack them without merging their scenario
vocabulary changes:

- `fixtures.patch`: adds 1,500-unit `medium` and `pool2`/`pool4`/`pool8` cohorts. Heap mode runs the
  requested updates before GC, so it measures warm state.
- `next-tick-fixture.patch`: compares public root markup immediately after each `nextTick`, omitting
  only the private inert Rich probe. `alternating` switches long content and `Ready`; the after slot
  renders its `clamped` payload into an attribute.
- `high-lines-fixture.patch`: adds 500-line / 20,000 px limits with `overflow-wrap:anywhere`.
- `class-width-fixture.patch`: moves width into a class declaration using a CSS custom property.

## Reproduction

Create separate baseline and candidate worktrees at the commit above, run `vp install`, apply the
chosen patch in the candidate, then build both with `vp run vue-clamp#build`. Keep the workspace's
original package names so the task runner resolves their build scripts. `$baseline` and `$candidate`
below denote their **built package directories**, ending in `packages/vue-clamp`.

In a separate driver checkout with `fixtures.patch` applied:

```sh
VUE_CLAMP_UPDATE_COUNTS=20 VUE_CLAMP_UPDATE_ROUNDS=8 VUE_CLAMP_UPDATE_STEPS=12 \
VUE_CLAMP_UPDATE_SCENARIOS=source-line-cjk-large-distinct,source-line-cjk-medium-pool4,source-inline-emoji-medium-pool4,source-inline-emoji-large-distinct,source-rich-cjk-large-distinct,font-rich-plain-metrics,resize-rich-plain,source-line-short \
vp exec node tools/benchmark/scripts/measure-update-costs.mjs "$baseline" "$candidate"

VUE_CLAMP_UPDATE_COUNTS=4 VUE_CLAMP_UPDATE_ROUNDS=8 VUE_CLAMP_UPDATE_STEPS=12 \
VUE_CLAMP_UPDATE_SCENARIOS=resize-wrap-tiny-height \
vp exec node tools/benchmark/scripts/measure-update-costs.mjs "$baseline" "$candidate"

VUE_CLAMP_UPDATE_COUNTS=20 VUE_CLAMP_UPDATE_ROUNDS=4 VUE_CLAMP_UPDATE_STEPS=6 \
VUE_CLAMP_UPDATE_SCENARIOS=source-line-cjk-medium-pool4,source-line-cjk-large-distinct,source-rich-plain-large-distinct,source-line-short-pool4 \
vp exec node tools/benchmark/scripts/measure-update-costs.mjs "$baseline" "$candidate" --heap
```

The driver alternates baseline/candidate/duplicate-baseline order and checks exact output after
every update. Set `VUE_CLAMP_UPDATE_BROWSER=firefox` or `webkit` for portable behavior comparisons;
`VUE_CLAMP_UPDATE_BROWSER_PATH` can select an installed compatible browser. Native CDP metrics and
forced-GC heap comparisons require Chromium. Keep timing runs serial with other build/test work.

The expanded Unicode check runs from a workspace root with dependencies installed:

```sh
vp exec node journey/research/332-prototypes/check-unicode.mjs "$baseline" "$candidate"
```

Optional `FIREFOX_EXECUTABLE` and `WEBKIT_EXECUTABLE` select local installed engines when they differ
from the Playwright defaults. The script verifies eager/deferred word/grapheme offsets, fallback
arrays and cursive flags against the baseline, then checks every admitted character.

For the trusted native-font comparison, create `$experiment/baseline` and `$experiment/combined`
links to built package directories. The fixture requires local Arial and Courier New faces:

```sh
EXPERIMENT_ROOT="$experiment" TARGETS=baseline,combined,control \
SCENARIOS=fontnative-rich-plain,fontnative-rich-plain-affix,fontnative-rich,fontnative-line,fontnative-inline \
COUNTS=20 ROUNDS=4 STEPS=4 METRICS=1 RESULT_NAME=native-font \
vp exec node journey/research/332-prototypes/compare-native-font.mjs
```

It fails unless every requested native font event is trusted and observed. Synthetic font-metric
rows in the ordinary driver test notification/remeasurement separately from this native delivery.

The full public-matrix screen uses the unchanged baseline driver:

```sh
VUE_CLAMP_BENCH_MIN_RUNS=2 VUE_CLAMP_BENCH_MAX_RUNS=2 VUE_CLAMP_BENCH_WARMUP_RUNS=1 \
VUE_CLAMP_BENCH_MIN_SCENARIO_MS=0 VUE_CLAMP_BENCH_COUNTERS=0 \
vp run benchmark#package -- --targets "$baseline,$candidate"
```

Two samples serve as an execution/regression screen, not a precise performance estimate. Production
integration additionally requires the normal check, unit, browser and build gates, plus focused
coverage for the new cache bounds, alphabet rule, growth endpoint and immediate slot settlement.

For consumer size, with package links under the same experiment root:

```sh
vp exec node journey/research/332-prototypes/measure-size.mjs "$experiment" baseline combined
```

This bundles each root export separately and all exports together using the installed Vite,
`minify: "esbuild"`, external Vue, then gzip level 9. Raw/minified bytes and gzip bytes are written
under `$experiment/sizes`. It excludes Vue, declarations and maps.

## Evidence format

`measurements.json` stores round-ordered native task/layout samples in milliseconds, layout counts,
heap bytes and matching DOM counters. `before`/`baseline` are the baseline, `after`/`combined` the
candidate, and `control` the duplicate baseline. Cross-engine sections record the executed scenario
set and package fingerprints; they make no timing claim. Paired changes use the exponential of the
mean per-round log ratio minus one, with 10,000 bootstrap resamples (seed 329). Medians are reported
separately and need not imply the same percentage as paired changes.
