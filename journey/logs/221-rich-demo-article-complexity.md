# 2026-04-08

- Starting a focused website-demo update for `RichLineClamp`:
  - move the demo closer to a styled article excerpt
  - cover nested inline structure such as bold text inside a link
- Updated the website rich demo in `packages/website/src/App.vue`:
  - changed the editorial preset into an article-style excerpt
  - added nested inline emphasis inside links, metadata, and a light-DOM custom wrapper in the
    same sample
  - aligned the rich example snippet, feature copy, demo help text, and API summary with that
    article-excerpt direction
- Updated `packages/vue-clamp/tests/demo-page.browser.test.ts` to assert the richer website copy
  and the nested `<a><strong>…</strong></a>` case shown by the article preset.
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
