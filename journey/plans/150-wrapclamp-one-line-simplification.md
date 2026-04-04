# WrapClamp one-line simplification

## Goal

Simplify the current `WrapClamp` runtime again:

- remove the hidden measurement host
- remove binary search from both the one-line predictor and the DOM clamp engine
- keep a one-line calculation hint, but build it only from widths observed in the real rendered DOM
- use linear DOM refinement for the final answer

## Direction

- Keep `maxLines === 1` and `maxHeight == null` as the only fast-path eligibility check.
- Record observed widths from the currently rendered state:
  - visible item widths keyed by `itemKey`
  - `before` width keyed by `visibleCount`
  - `after` width keyed by `hiddenCount`
- Derive an optional one-line candidate by scanning visible counts linearly across cached widths.
  - Do not assume monotonic fit.
  - Track the best known fitting count across all known counts.
- Replace the current binary-search fallback with a single linear settle loop:
  - if the current candidate overflows, shrink by one until it fits
  - if the current candidate fits, grow by one until the next candidate fails
- Remove the hidden measurement DOM and any test-only filtering that exists solely because of it.

## Validation

- `vp check --fix`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
- `vp run test:browser`
- `vp run build -r`
