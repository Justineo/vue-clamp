# InlineClamp continuous flow

## 2026-04-17

- Reviewed the current `InlineClamp` implementation and browser tests. The public behavior is
  currently tied to `inline-flex`: fixed `start` / `end`, shrinkable `body`, and native
  `text-overflow`.
- Verified the core trade-off: replacing flex with grid/table/inline-block body boxes still keeps
  independently shaped regions and does not solve the boundary rendering issue.
- Ran a small Chromium probe comparing a single text run, ordinary inline spans, flex items, and
  inline-block spans. Ordinary inline spans reduce layout isolation, but a single text run remains
  the only shape that can be treated as equivalent to the original source string.
- Recommended direction: keep native ellipsis only for the unsplit case; move split-mode
  `InlineClamp` to JS measurement and render the visible result as continuous inline text.
- The accepted implementation direction is stronger: remove `InlineClamp`'s native
  `text-overflow` dependency entirely, add `ellipsis`, and use JS measurement for both unsplit and
  split text. This gives custom ellipsis support and allows the rewritten `body` to become only the
  ellipsis when the fixed affixes leave no room for source body graphemes.
- Implemented the measured inline-flow model in `InlineClamp`: `inline-block` root, ordinary inline
  segments, hidden probe measurement, grapheme-safe body search, custom `ellipsis`, font/resize
  invalidation, and hidden full-text accessibility backup when visible text is rewritten.
- Updated focused inline tests and website demo tests for the new contract. Validation passed with
  `vp check`, `vp test`, focused browser tests, and full `vite.browser.config.ts` browser tests.
