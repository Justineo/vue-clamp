# InlineClamp location log

## 2026-04-18

- Added `location` to `InlineClamp` with the same `start` / `middle` / `end` / numeric-ratio
  semantics as `LineClamp`, defaulting to `end` for existing behavior.
- Scoped the new placement logic to the shrinkable `body` segment. Split `start` and `end` output
  still renders as fixed inline text around the measured body.
- Reused the shared grapheme preparation, search, and location-normalization helpers. Kept an
  Inline-specific formatter so clamped `body` output preserves meaningful spacing at split
  boundaries.
- Updated the package README, website API reference, and snippet to document `location`.
- Added the same location preset and numeric-ratio controls to the InlineClamp demo and wired them
  into both plain and split examples.
- Refactored the shared location prop declaration and kept-count text search so `LineClamp` and
  `InlineClamp` use the same candidate generation/search path. `InlineClamp` passes the
  split-boundary spacing mode to preserve spaces around fixed `start` and `end` segments.
- Extracted the other identical public prop declarations that are shared across components:
  `blockAsProp`, `ellipsisProp`, `expandedProp`, `maxLinesProp`, and `maxHeightProp`.
- Focused validation passed:
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/inline.browser.test.ts`
- Required validation passed:
  - `vp check`
  - `vp test`
