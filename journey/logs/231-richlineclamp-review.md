# 2026-04-09 RichLineClamp review

- Reviewed the current `feat/rich-text` worktree against `main`, including the untracked
  `RichLineClamp`, `rich.ts`, and `layout.ts` files plus related refactors.
- Validation run:
  - `vp install`
  - `vp check`
  - `vp test packages/vue-clamp/tests/exports.test.ts`
  - `vp run test:browser -- packages/vue-clamp/tests/clamp.browser.test.ts`
- Findings:
  - Unsupported rich-html fallback still gets visually clipped when `maxHeight` is set because the
    root keeps the collapsed `maxHeight` + `overflow: hidden` path even after the runtime decides
    to fall back to raw HTML unchanged.
  - The public exports test was not updated to assert the new `RichLineClamp` root export.
