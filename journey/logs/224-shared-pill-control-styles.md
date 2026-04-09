# 2026-04-08

- Starting a website consistency pass for pill-like controls:
  - the demo preset pills, install tabs, and component tabs currently each carry separate visual
    rules
  - the goal is to share one control style while keeping each surface's layout and behavior local
- Added `packages/website/src/pillControls.css` and imported it from `packages/website/src/main.ts`
  so the website has one shared pill-button visual primitive.
- Moved the install tabs, demo preset pills, and component tabs onto that shared style while
  trimming `App.vue` and `ComponentTabs.vue` back to layout- and behavior-specific rules.
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
