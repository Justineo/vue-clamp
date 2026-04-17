# Empty slot vnode filtering log

## 2026-04-03

- Chose VNode-content filtering over CSS `:empty` and over DOM-postprocessing.
- Ignoring Vapor compatibility for this change.
- Constrained the implementation to Vue public exports only.
- Added shared `slot.ts` and used it in `LineClamp` and `WrapClamp`.
- Added browser regressions to prove empty slot output does not render `before` / `after` wrappers.
- Adjusted the website demo regression to re-query the wrap-tabs trigger after the RTL toggle because the node can rerender.
- Validation passed with:
  - `vp check`
  - `vp test`
  - `vp run test:browser`
