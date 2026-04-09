# 2026-04-09

- Starting website scrollbar integration with `overlayscrollbars`:
  - target the page body and the actual scrollable website containers
  - avoid one-off setup code by introducing a small reusable integration layer
- Implemented the website integration:
  - added `packages/website/src/overlayScrollbars.ts` with one small directive/helper layer
  - initialized body scrollbars from the root app and bridged body flicker via `index.html`
  - applied the shared helper to demo previews and code blocks
- Follow-up:
  - removed OverlayScrollbars from `ComponentTabs`
  - restored the native horizontal scroller there so the tabs keep their dedicated overflow behavior
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
