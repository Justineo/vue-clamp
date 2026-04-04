# WrapClamp cache benchmark and correctness

## Goal

Quantify whether the removed `WrapClamp` growth-hint cache materially improves the stress-table experience, and add enough coverage to judge whether a cache-backed strategy can stay correct under external changes.

## Direction

- Build an internal A/B benchmark surface that compares:
  - the current direct live-DOM growth path
  - a cache-backed single-line growth-hint variant
- Use the table-style repeated `WrapClamp` workload rather than a synthetic single-instance case.
- Record timing across width sweeps, not just one mount.
- Keep any cache-backed path internal to source/tests unless the data justifies restoring it publicly.
- Add correctness coverage around the cache's risky invalidation cases:
  - hidden item content changes
  - width changes
  - `after` slot width changes
  - item-key and item-list changes
  - font / external layout-triggered recomputes where practical

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.cache.browser.test.ts`
- `vp run test:browser`
