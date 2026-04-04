# WrapClamp bare minimum simplification

## Goal

Reduce `WrapClamp` to the smallest defensible implementation while preserving the current public behavior.

## Direction

- Remove the DOM binary-search clamp path.
- Use one visible-DOM settle loop everywhere:
  - start from the current rendered count
  - shrink until the current state fits
  - then grow one item at a time until the next probe fails
- Keep the existing public contract and browser-aligned measurement model.
- Only keep reactive and observer logic that still earns its place after the clamp engine is simplified.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
- `vp test -c vite.browser.benchmark.config.ts`
