# 2026-04-08

- Simplified the website `RichLineClamp` demo by removing the `before` slot prefix from both the
  live preview and the copied example snippet.
- Updated the canonical website-demo note in `journey/design.md` so it no longer claims that the
  rich demo uses a slot prefix.
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
