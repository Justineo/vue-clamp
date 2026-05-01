# LineClamp search performance log

Date: 2026-04-30

## Implementation

- Reduced `fitsContent` probe overhead:
  - no array allocation for every `getClientRects()` result
  - no full line collection when the line limit is already exceeded
  - visible max-height bounds are measured lazily only when a non-empty rect exists
- Added a reusable warm-start kept-count search:
  - starts from the previous kept count when the prepared boundary offsets still match
  - expands outward until it brackets the new fit boundary
  - binary-searches only the bracketed interval
- `LineClamp` and `InlineClamp` keep only the last text-search result and pass it back to the
  shared search helper on subsequent reclamps.
- `InlineClamp` also caches prepared body text across width-only reclamps.
- The implementation was simplified after testing: component-level search-context caches were
  replaced with a single last-result hint, and `clampTextToFit` now directly returns that result.
- `searchKeptCount` is no longer exported for tests; warm-start coverage now exercises the text
  clamp helper contract directly.

## Constraint handling

The implementation does not defer recompute with animation-frame throttling. Candidate probing still
finishes synchronously inside the clamp pass before the final visible state is committed, so the
component does not intentionally paint stale or unclamped output after layout changes.

## Validation

- `vp check` on touched files
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/inline.browser.test.ts`

## Benchmark comparison

Compared current worktree against `947de14` using
`packages/vue-clamp/tests/text.browser.benchmark.ts`, a browser benchmark for the text clamp hot
path. Each scenario uses one warmup run and five measured runs; values below are medians.

The direct scenarios call the clamp helper directly and split cold search from warm-start search.
Continuous uses 1px steps, jitter uses deterministic random small deltas, and jumps alternates
between distant widths.

| Scenario               | Version   | Steps |     Total | Mean step | Primary layout reads |
| ---------------------- | --------- | ----: | --------: | --------: | -------------------: |
| line continuous cold   | `947de14` |   560 | `139.1ms` | `0.248ms` |               `6577` |
| line continuous cold   | current   |   560 | `130.7ms` | `0.233ms` |               `6577` |
| line continuous warm   | `947de14` |   560 | `136.5ms` | `0.244ms` |               `6577` |
| line continuous warm   | current   |   560 |  `58.0ms` | `0.104ms` |               `2414` |
| line jitter cold       | `947de14` |   280 |  `69.3ms` | `0.248ms` |               `3304` |
| line jitter cold       | current   |   280 |  `64.2ms` | `0.229ms` |               `3304` |
| line jitter warm       | `947de14` |   280 |  `70.5ms` | `0.252ms` |               `3304` |
| line jitter warm       | current   |   280 |  `36.5ms` | `0.130ms` |               `1890` |
| line jumps cold        | `947de14` |   109 |  `28.2ms` | `0.259ms` |               `1268` |
| line jumps cold        | current   |   109 |  `25.3ms` | `0.232ms` |               `1268` |
| line jumps warm        | `947de14` |   109 |  `27.9ms` | `0.256ms` |               `1268` |
| line jumps warm        | current   |   109 |  `27.8ms` | `0.255ms` |               `1686` |
| inline continuous cold | `947de14` |   460 |  `31.3ms` | `0.068ms` |               `3975` |
| inline continuous cold | current   |   460 |  `31.2ms` | `0.068ms` |               `3975` |
| inline continuous warm | `947de14` |   460 |  `30.5ms` | `0.066ms` |               `3975` |
| inline continuous warm | current   |   460 |  `15.2ms` | `0.033ms` |               `1898` |
| inline jitter cold     | `947de14` |   230 |  `14.6ms` | `0.063ms` |               `1986` |
| inline jitter cold     | current   |   230 |  `14.9ms` | `0.065ms` |               `1986` |
| inline jitter warm     | `947de14` |   230 |  `15.6ms` | `0.068ms` |               `1986` |
| inline jitter warm     | current   |   230 |   `8.0ms` | `0.035ms` |               `1075` |
| inline jumps cold      | `947de14` |   109 |   `6.9ms` | `0.063ms` |                `931` |
| inline jumps cold      | current   |   109 |   `7.0ms` | `0.064ms` |                `931` |
| inline jumps warm      | `947de14` |   109 |   `7.3ms` | `0.067ms` |                `931` |
| inline jumps warm      | current   |   109 |   `9.6ms` | `0.088ms` |               `1266` |

The component scenarios mount real Vue components and update their width style through Vue, so they
include component update and recompute overhead.

| Scenario                    | Version   | Steps |    Total | Mean step | Primary layout reads |
| --------------------------- | --------- | ----: | -------: | --------: | -------------------: |
| component line continuous   | `947de14` |   140 | `39.5ms` | `0.282ms` |               `1647` |
| component line continuous   | current   |   140 | `20.6ms` | `0.147ms` |                `723` |
| component inline continuous | `947de14` |   114 | `12.7ms` | `0.111ms` |                `985` |
| component inline continuous | current   |   114 |  `8.7ms` | `0.076ms` |                `514` |

Takeaways:

- Warm-start is the main win for continuous and jittered resize: multiline warm-start is about
  `2.3x` faster on the 1px sweep and `1.9x` faster on jitter; inline warm-start is about `1.9x`
  faster on the 1px sweep and `2.0x` faster on jitter.
- Cold search is mostly unchanged except for small timing noise; this isolates the benefit to the
  warm-start path rather than the benchmark harness.
- Large alternating jumps can make warm-start do more probes than cold search because the previous
  kept count is far from the new answer. This benchmark keeps that case visible instead of hiding
  it in the continuous sweep.
- End-to-end component measurements still improve: `LineClamp` drops from `39.5ms` to `20.6ms`
  over 140 updates, and `InlineClamp` drops from `12.7ms` to `8.7ms` over 114 updates.

## Rich benchmark comparison

Ran the existing `packages/vue-clamp/tests/rich.browser.benchmark.ts` against `947de14` and the
current worktree. This benchmark exercises the direct rich clamp helper with its cached rich
decision path.

| Scenario                 | Version   |    Total | Mean step | `getClientRects()` | Clone calls |
| ------------------------ | --------- | -------: | --------: | -----------------: | ----------: |
| `fit-width-sweep`        | `947de14` |  `0.1ms` | `0.013ms` |                `8` |         `0` |
| `fit-width-sweep`        | current   |  `0.2ms` | `0.025ms` |                `8` |         `0` |
| `truncate-width-sweep`   | `947de14` |  `1.5ms` | `0.194ms` |               `77` |        `34` |
| `truncate-width-sweep`   | current   |  `1.5ms` | `0.188ms` |               `77` |        `34` |
| `dense-grid-width-sweep` | `947de14` | `43.7ms` | `7.283ms` |             `1890` |        `40` |
| `dense-grid-width-sweep` | current   | `43.1ms` | `7.192ms` |             `1890` |        `40` |

The rich path is effectively unchanged by this text warm-start optimization. Layout read counts and
clone counts are identical; timing differences are within benchmark noise. That matches the
implementation shape: `RichLineClamp` has its own decision cache and structural patching path, and
only shares the lower-level `fitsContent` helper with text clamping.

## Follow-up note

The text search helper was subsequently moved into a shared bounded warm-start helper so
`RichLineClamp` could reuse the same optimization idea without adopting text-specific contracts.
The final benchmark matrix and current numbers are recorded in
`journey/logs/279-rich-shared-search-performance.md`.
