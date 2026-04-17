# InlineClamp width growth reclamp

## Problem

`InlineClamp` can shrink when available width decreases, but it does not restore previously trimmed
body text when available width grows again.

## Root cause to validate

The clamp pass reads `rootElement.getBoundingClientRect().width` before temporarily restoring the
full body text. After a prior clamp, an `inline-block` root can be sized by the shortened visible
text, so that stale root width becomes the next search limit even when the parent/container has
grown.

## Plan

1. Add a focused browser regression test that shrinks, then grows, the host width and expects the
   body segment to restore to the full source body.
2. Fix `InlineClamp` to restore the full body before reading the root width, so the measured limit
   reflects the current parent/root constraint instead of the already-clamped inline-block width.
3. Keep the fix local to `InlineClamp`; do not add a shared abstraction unless the final code is
   simpler.
4. Validate with the focused inline browser test, `vp check`, `vp test`, browser tests, and build.
