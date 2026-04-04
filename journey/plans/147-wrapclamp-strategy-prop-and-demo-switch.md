# WrapClamp strategy prop and demo switch

## Goal

Expose the `WrapClamp` direct-vs-cache recompute choice as a prop, surface it in the website stress-table demo, and make the demo capable of exercising the branch where the cache can actually matter.

## Direction

- Add a typed `strategy` prop to `WrapClamp`.
- Keep the default public behavior aligned with the current direct live-DOM path.
- Preserve the internal `WrapClampWithGrowthCache` benchmark helper by mapping it to a different default strategy.
- Add a browser test that verifies changing the prop at runtime keeps `WrapClamp` correct.
- Add stress-table demo controls for:
  - width
  - strategy
  - line limit
- Document in the demo/API copy that `cache` currently only affects the single-line growth shortcut.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
