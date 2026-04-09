# 2026-04-09 RichLineClamp best-effort contract

- Relaxed `RichLineClamp` preparation to stop rejecting broad classes of elements up front.
- Leaf elements without light DOM content now participate as atomic inline units, including custom
  elements.
- Runtime fallback remains only for rendered layout that leaves inline flow or otherwise breaks the
  clamp model, such as positioned or floated descendants.
- Fixed the `maxHeight` fallback path so raw-html fallback content is no longer clipped by the
  collapsed root styles.
- Updated package docs, website copy, design memory, and browser tests to match the new
  best-effort inline-flow contract.
- Validation run:
  - `vp test packages/vue-clamp/tests/exports.test.ts`
  - `vp run test:browser -- packages/vue-clamp/tests/clamp.browser.test.ts`
  - `vp run test:browser -- packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `vp check`
