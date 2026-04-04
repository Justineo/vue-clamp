# WrapClamp recompute simplification

## Goal

Simplify the recent `WrapClamp` rerender-stability fix by reducing unnecessary work in `recompute()` and removing guard logic that is only compensating for self-inflicted churn.

## Direction

- Stop unconditionally resetting to the full item list at the start of every collapsed recompute.
- Start from the current rendered state and only probe the full list when the current clamped prefix already fits and there may be room to grow.
- Remove the layout-signature dedupe if the simpler recompute flow makes it unnecessary.
- Keep the existing idle-stability regression.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- `vp run test:browser`
