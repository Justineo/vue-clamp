# 2026-04-08

- Investigating a reported regression in the newly added `LineClamp` rich-text path:
  width shrink can briefly show stale `html` output with more visible lines than `maxLines`.
- Current design memory still documents the old trade-off that resize/font changes may briefly show
  stale content before the next DOM-driven recompute.
- Next step is a focused browser test on width shrink for `html` mode so the fix is tied to a
  concrete failing frame sequence rather than visual anecdote.
- Reproduced the regression with a focused browser test:
  - after shrinking a rich-html clamp from `260px` to `140px`
  - immediately after `nextTick()`, the stale DOM still showed `5` visible lines for `maxLines=2`
- Root cause:
  - `LineClamp` only relied on `ResizeObserver` to notice width changes coming from parent-driven
    reactive layout updates
  - when the component's root width changed during the same Vue flush, the previous `renderedHtml`
    survived until the later observer delivery
  - because `maxLines` alone does not provide a CSS vertical clip box, those stale extra lines were
    fully visible
- Fix:
  - `LineClamp` now runs `requestRecompute()` from `onUpdated` whenever its post-render layout
    signature differs from the last settled signature
  - this keeps clamp correction inside the same Vue update cycle for reactive width/slot changes
    instead of waiting for the observer path
- Added a permanent browser regression covering the first frame after a rich-html width shrink.
