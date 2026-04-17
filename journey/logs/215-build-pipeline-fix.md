# Build Pipeline Fix

- 2026-04-18: Replaced the empty recursive workspace build with a root build that runs the
  `website...` dependency chain through Vite+ filtering, so `vue-clamp#build` runs before
  `website#build` without selecting the root package.
- Updated CI and release workflows to call `vp run build` so `packages/website/dist` exists before
  the Void `deploy --skip-build` step.
- Validation passed with `vp run ready`, `vp pm audit -- --audit-level=moderate`, and npm publish
  dry-run. Browser tests still print the known non-fatal `ResizeObserver loop completed with
undelivered notifications.` noise.
