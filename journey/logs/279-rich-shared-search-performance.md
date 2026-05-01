# Rich clamp shared search performance log

Date: 2026-05-01

## Progress

- Started after text warm-start benchmark showed strong continuous/jitter gains but possible large
  jump regressions.
- Plan: share the monotonic search helper, then decide Rich adoption based on benchmark evidence.

## Implementation

- Added `src/search.ts` as the shared monotonic "last fitting index" helper.
- The helper accepts an optional previous index, probes near that index first, then falls back to
  binary search over the remaining range after two local expansion steps. This keeps the continuous
  resize win while bounding the penalty when width jumps far away from the previous fit point.
- Replaced the text-only kept-count search with this shared helper. `LineClamp` and `InlineClamp`
  still pass only the previous text clamp result; no component-level search context cache was
  reintroduced.
- Updated `RichLineClamp` to use the same search strategy without sharing text-specific contracts:
  the previous `RichClampDecision` is mapped to a coarse logical-run index and, when applicable, a
  fine text-cut index.
- Split rich clamp internals into two concepts:
  - `currentDecision` describes the hidden probe DOM's current patch state.
  - `searchDecision` is the optional warm-start hint.
- `RichLineClamp` now disables `searchDecision` for width jumps over 32px, but still passes the
  current probe decision for correct structural patching. This keeps large jumps close to cold
  search without repainting stale visible content.
- Expanded browser benchmarks for text and rich paths:
  - direct cold/warm continuous sweep
  - deterministic jitter
  - large width jumps
  - component end-to-end width updates

## Latest benchmark notes

Benchmarks compare the current worktree with `947de14` using the same benchmark files copied into a
detached baseline worktree. Values are medians after one warmup run.

- Text direct warm-start:
  - line continuous: `136.8ms` baseline warm -> `60.8ms` current warm; client rect reads
    `6577 -> 2510`
  - line jitter: `71.0ms` -> `46.7ms`; client rect reads `3304 -> 2303`
  - inline continuous: `31.4ms` -> `16.0ms`; scroll-width reads `3975 -> 1898`
  - inline jitter: `15.2ms` -> `8.2ms`; scroll-width reads `1986 -> 1090`
- Text large jumps remain bounded:
  - line jumps warm: `28.0ms` baseline -> `24.9ms` current, with reads `1268 -> 1386`
  - inline jumps warm: `7.6ms` baseline -> `8.4ms` current, with reads `931 -> 1116`
- Text component E2E:
  - line continuous: `41.4ms` -> `22.4ms`; client rect reads `1647 -> 806`
  - inline continuous: `13.2ms` -> `8.5ms`; scroll-width reads `985 -> 514`
- Rich direct warm-start:
  - continuous: `62.1ms` baseline warm -> `39.8ms` current warm; client rect reads
    `3580 -> 2054`
  - jitter: `36.9ms` -> `30.6ms`; client rect reads `2276 -> 1795`
  - dense forced-warm jumps still show why component guard exists: `43.4ms` baseline warm ->
    `48.3ms` current warm.
- Rich component E2E:
  - continuous: `22.9ms` -> `17.7ms`; client rect reads `902 -> 590`
  - jumps: `4.7ms` -> `4.7ms`; width-jump guard keeps it neutral.

## Validation

- `vp check`
- `vp test packages/vue-clamp/tests/text.test.ts`
- `vp test`
- `vp run test:browser`
- `vp run build`
- `vp test -c vite.browser.benchmark.config.ts packages/vue-clamp/tests/text.browser.benchmark.ts`
- `vp test -c vite.browser.benchmark.config.ts packages/vue-clamp/tests/rich.browser.benchmark.ts`
