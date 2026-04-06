# 2026-04-06 Fix browser test font-size assertion

- Confirmed the shared line-demo textarea now inherits the demo control typography, so the
  hardcoded `16px` browser-test expectation was stale.
- Removed that style snapshot from the multiline-editor propagation test.
- Replaced the old narrow-width monotonic-length regression check with a browser-fit proximity
  sweep over the same workspace demo widths.
- Renamed the affected demo-page tests so they point at the workspace `LineClamp` toggle demo
  instead of `InlineClamp`.
- Validation:
  - `vp check`
  - `vp test`
  - `vp run test:browser`
