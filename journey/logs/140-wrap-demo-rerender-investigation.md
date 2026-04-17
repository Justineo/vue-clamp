# Wrap demo rerender investigation log

## 2026-04-03

- Started by comparing website wrap-demo state/derived values with the `WrapClamp` recompute path.
- Found the core issue in `WrapClamp`: `recompute()` resets to the full item list before settling back to the clamped prefix, while the component also observes its own root/content/slot boxes. That let internal visibility changes feed back into ResizeObserver and keep the render cycle hot.
- Added an observer guard that ignores callbacks while a recompute is in flight and skips callbacks whose layout signature matches the last settled state.
- Added a browser regression that idles a clamped `WrapClamp` for extra frames and asserts the slot render count stays flat.
- The targeted wrap-browser regression now passes, which confirms the component itself settles.
- The full browser suite still emits generic `ResizeObserver loop completed with undelivered notifications` noise, so there is likely broader observer churn outside this specific `WrapClamp` rerender issue.
- Follow-up direction: simplify `WrapClamp.recompute()` so it starts from the current rendered prefix instead of always resetting to the full item list, then re-check whether the extra observer dedupe can be removed.
