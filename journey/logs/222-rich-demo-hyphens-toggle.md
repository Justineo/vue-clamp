# 2026-04-08

- Starting a small follow-up for the website `RichLineClamp` demo:
  - add the same `CSS Hyphens` toggle pattern already used by the text demos
  - make sure the rich article excerpt can be previewed with or without browser hyphenation
- Updated `packages/website/src/App.vue`:
  - added `richHyphens5` and bound it to the `RichLineClamp` preview through the existing
    `.hyphens` class
  - added a `CSS Hyphens` checkbox to the rich demo controls plus a short note in the help copy
- Updated `packages/vue-clamp/tests/demo-page.browser.test.ts` to assert that the rich demo
  hyphenation toggle flips the preview root class on and off.
- Validation:
  - `vp fmt packages/vue-clamp/tests/demo-page.browser.test.ts packages/website/src/App.vue journey/design.md journey/logs/222-rich-demo-hyphens-toggle.md journey/plans/222-rich-demo-hyphens-toggle.md`
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
