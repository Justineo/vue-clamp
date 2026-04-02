# Demo Site Polish

## Scope

- `packages/website/src/App.vue`
- `packages/vue-clamp/tests/demo-page.browser.test.ts`

## Changes

1. Improve the demo text container styling, especially the right edge.
2. Remove demo-only `data-testid` attributes from the website markup.
3. Make the demo browser tests target the first demo by structure instead.
4. Enable hyphenation by default for demos.
5. Reduce the default `max-height` demo value to `calc(36px + 6em)`.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build -r`
