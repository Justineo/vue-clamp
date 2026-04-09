# 2026-04-08

- Polishing the website component tabs after the first scrollable-tabs pass:
  - remove the mobile scrollbar/separator artifact
  - hide the native scrollbar
  - add a clearer overflow cue for hidden tabs
- Implemented:
  - `packages/website/src/ComponentTabs.vue` now hides the native scrollbar while keeping the tab
    row horizontally scrollable
  - the outer tabs shell now clips the row cleanly so the mobile scrollbar/separator artifact is
    gone
  - tab labels now ellipsize instead of feeling abruptly cut off
  - the tab row now exposes lightweight overflow state:
    - edge fades when content continues off-screen
    - a small `More` cue while additional tabs remain to the right
    - the cue disappears once the user reaches the end
  - `packages/vue-clamp/tests/demo-page.browser.test.ts` now checks the overflow cue behavior and
    the truncation-ready tab styling
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
- Browser noise remains unchanged:
  - `ResizeObserver loop completed with undelivered notifications.`
  - Shiki singleton warnings in website browser tests
