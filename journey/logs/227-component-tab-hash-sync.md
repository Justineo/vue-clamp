# 2026-04-09

- Starting website component-tab hash sync:
  - add stable surface hashes for direct links
  - sync `activeSurface` from recognized hashes on mount and browser navigation
  - keep unrelated section hashes independent from the tab state
- Implemented:
  - added stable tab ids / hashes for `LineClamp`, `RichLineClamp`, `InlineClamp`, and `WrapClamp`
  - initialized the active surface from recognized hashes before first render
  - wrote new hashes on tab selection and listened for later `hashchange` navigation
  - ignored unrelated section hashes so tab state does not reset when the route moves to a normal
    page anchor
- Validation:
  - `vp check`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `CI=1 vp run test:browser`
