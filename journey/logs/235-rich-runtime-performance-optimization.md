# 2026-04-09 Rich runtime performance optimization

- Started a focused optimization pass for `RichLineClamp`.
- Targeting the highest-value hot-path costs first:
  - unchanged rich content still paying preprocessing work
  - repeated grapheme/run rebuilding across reclamps
  - clone -> serialize -> `innerHTML` parse inside binary-search probes
- Implemented the safe runtime wins in `packages/vue-clamp/src/rich.ts`:
  - rich preprocessing now parses and caches text/grapheme boundary metadata once per source HTML
  - unchanged rich content now returns before logical-run construction after layout validation
  - candidate probes now clone and apply prefix fragments directly to the live DOM instead of
    serializing/parsing HTML for every binary-search probe
- Tried a more aggressive unchanged-content fast path before layout validation, but rejected it
  because it suppressed the existing dev warning for unsupported rich layout and caused
  `maxHeight` fallback oscillation.
- Validation after the optimization pass:
  - `vp check`
  - `vp run test:browser -- packages/vue-clamp/tests/clamp.browser.test.ts`
  - `vp run test:browser -- packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `vp test packages/vue-clamp/tests/exports.test.ts`
- Residual note: the repo still has no dedicated rich runtime benchmark, so this pass improves the
  hot path by code-path analysis plus behavior validation rather than by before/after benchmark
  numbers.
