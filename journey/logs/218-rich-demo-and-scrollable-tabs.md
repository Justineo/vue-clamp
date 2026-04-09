# 2026-04-08

- Starting a website-focused pass:
  - make the `RichLineClamp` demo more realistic and interactive
  - make the component tabs horizontally scrollable when they no longer fit
- Implemented:
  - `packages/website/src/App.vue` now has an editable `RichLineClamp` demo with three trusted
    inline-HTML presets and a textarea for custom markup
  - the rich demo now shows a slot prefix and richer inline content while staying inside the
    supported-subset rules
  - `packages/website/src/ComponentTabs.vue` now renders the component tabs inside a horizontal
    scroll container so narrow viewports can swipe/scroll instead of forcing overly narrow buttons
  - coarse/narrow layouts hide tab tooltips to avoid clipping inside the scroll container
  - `packages/vue-clamp/tests/demo-page.browser.test.ts` now covers the richer rich-html demo and
    the mobile-width tab overflow behavior
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
- Browser noise remains unchanged:
  - `ResizeObserver loop completed with undelivered notifications.`
  - Shiki singleton warnings in website browser tests
