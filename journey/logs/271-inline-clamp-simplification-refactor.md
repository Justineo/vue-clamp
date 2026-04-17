# InlineClamp simplification refactor log

## 2026-04-17

- Removed the measured `InlineClamp` content wrapper and custom width-resolution helpers.
- Made the root element serve as both the clip box and measured inline content, using
  `scrollWidth` against the root width during the existing grapheme-safe search.
- Replaced callback ref plumbing with a normal body ref and aligned observer invalidation with the
  layout-signature guard used by the other measured components.
- Deleted the old boundary-space preservation helpers because split segments now stay in normal
  inline flow rather than separate flex item boxes.
- Removed defensive `split` result normalization and stopped observing the body segment directly;
  source changes are already reactive, and width changes are covered by the root/parent observers.
- Kept the shared `searchKeptCount` primitive from `text.ts`; no new shared abstraction was added.
- Validation passed:
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/inline.browser.test.ts`
  - `vp check`
  - `vp test`
  - `vp run test:browser`
  - `vp run vue-clamp#build`
- Follow-up cleanup inlined split resolution and segment rendering in `InlineClamp`, leaving only
  the body candidate helper and shared `searchKeptCount` primitive.
- Revalidated after the cleanup with the same command set. The browser suite still reports the
  existing ResizeObserver loop console noise, but all browser tests pass.
