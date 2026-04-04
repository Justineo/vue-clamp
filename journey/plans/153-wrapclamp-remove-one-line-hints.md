# WrapClamp remove one-line hints

## Goal

Remove the current `WrapClamp` one-line hint layer now that the benchmark shows it adds geometry work without producing an elapsed-time win.

## Direction

- Collapse `WrapClamp` back to a single visible-DOM clamp engine.
- Remove:
  - one-line width caches
  - one-line candidate calculation
  - the benchmark-only `WrapClampWithoutOneLineHints` export
  - comparison-specific benchmark scaffolding
- Keep the dedicated browser benchmark, but make it a workload benchmark for the real component instead of an internal A/B harness.
- Update docs and website messaging so they no longer claim a special one-line calculation path.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
- `vp test -c vite.browser.benchmark.config.ts`
