# InlineClamp width growth reclamp log

## 2026-04-17

- Started from a suspected root-cause path: `InlineClamp` measures the current root width before
  restoring the full body text, so a previously clamped `inline-block` can become its own stale
  width limit after the parent grows.
- Added a browser regression test that mounts `InlineClamp` inside a resizable parent instead of
  assigning width directly to the root. The test failed before the fix: after growing from `120px`
  to `360px`, the body stayed at `very-long-…`.
- Fixed the clamp pass by restoring the full body text before reading the root width. The measured
  limit now reflects the expanded parent/root constraint rather than the prior shortened text.
- Focused validation passed:
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/inline.browser.test.ts`
  - `vp check`
- Full validation passed:
  - `vp test`
  - `vp run test:browser`
  - `vp run vue-clamp#build`
- `vp run test:browser` still prints the existing ResizeObserver loop console noise, but all
  browser tests pass.
