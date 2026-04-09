# 2026-04-08

- Reworking the website control refactor:
  - restore `ComponentTabs` to its dedicated visual design
  - use a reusable `PillControls` component for the install/demo preset groups instead of forcing
    every control surface onto the same tab styling
- Added `packages/website/src/PillControls.vue` and moved the demo preset groups in `App.vue`
  onto that reusable component.
- Restored the installation block to its original dedicated tab-strip styling after the generic
  pill component was applied too broadly there.
- Restored `packages/website/src/ComponentTabs.vue` to its earlier dedicated visual treatment while
  keeping the existing horizontal overflow, fade, and `More` affordance behavior intact.
- Removed the temporary global `pillControls.css` path and updated website memory in
  `journey/design.md`.
- Validation:
  - `vp fmt packages/website/src/PillControls.vue`
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
