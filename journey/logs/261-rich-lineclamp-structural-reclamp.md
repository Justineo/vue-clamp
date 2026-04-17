# 261 RichLineClamp structural reclamp

## Progress

- Replaced rich clamp hot-path HTML-string results with structural decisions (`full` or
  `clamped` boundary point).
- Added a shared rich patch primitive that preserves the stable prefix, replaces only the changed
  suffix, and appends ellipsis for clamped decisions.
- Moved `RichLineClamp` binary search onto a persistent hidden probe tree.
- Changed visible rich updates so width-only reclamps patch the visible DOM instead of assigning
  clamped `innerHTML`.
- Kept the existing bounded image-settlement behavior and intentionally did not add probe image
  placeholders or `srcset`-specific handling in this pass.

## Validation

- `vp check packages/vue-clamp/src/rich.ts packages/vue-clamp/src/RichLineClamp.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
- `vp run benchmark:rich`

The browser runs still print the existing `ResizeObserver` console noise, and the demo-page test
still prints the existing Shiki singleton warning.
