# 2026-04-09 Boundary-oriented rich text clipping

- Replaced the rich clamp search in `packages/vue-clamp/src/rich.ts` with a boundary-oriented
  two-level search:
  - coarse binary search over logical run ends
  - fine binary search over grapheme-safe cuts inside only the next text run
- Switched candidate generation from mixed-unit reconstruction to prefix slicing of the original
  parsed tree, with ellipsis insertion before fit testing.
- Added runtime classification so inline formatting contexts such as `inline-block` and
  `inline-flex` are treated as atomic runs during search.
- Kept the existing runtime fallback for layout that exits inline flow, plus the unclipped
  `maxHeight` fallback behavior added earlier in `RichLineClamp`.
- Added browser coverage for inline-block atomic behavior in
  `packages/vue-clamp/tests/clamp.browser.test.ts`.
- Validation run:
  - `vp run test:browser -- packages/vue-clamp/tests/clamp.browser.test.ts`
  - `vp run test:browser -- packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `vp check`
