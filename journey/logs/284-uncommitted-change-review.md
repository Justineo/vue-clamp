# Uncommitted change review log

## 2026-05-03

- Reviewed the current uncommitted branch changes by area: library runtime, tests, website stress
  playground, dependencies, and journey records.
- Kept the library runtime changes that directly serve the 1.4 goals: conservative native
  single-line/multi-line `LineClamp` paths, text final-apply controllers, numeric line-box grouping,
  and development-only rich fallback diagnostics.
- Removed newly added type noise and redundant browser coverage that did not protect a distinct
  user-facing contract.
- Kept the stress playground as manual diagnostic tooling and scoped the FPS meter to that modal.
  Simplified its copy so it does not present itself as automated performance-regression tooling.
- Lazy-loaded the stress playground so `stats.js` and the high-count diagnostic UI do not join the
  primary website bundle.
- Added a local modal focus trap so scroll lock and `aria-modal` do not leave keyboard focus free to
  move into the background page.
- Aligned native multiline support detection with rendering by writing both standard `line-clamp`
  and prefixed `-webkit-line-clamp` styles.
