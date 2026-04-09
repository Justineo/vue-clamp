# App.vue type error investigation

## Goals

- Reproduce the Vue type errors the editor reports in `packages/website/src/App.vue`.
- Identify why `vp check` is not surfacing the same issue.
- Fix the source or the typecheck coverage so command-line validation matches editor reality.

## Plan

1. Inspect `App.vue` and the repo TypeScript / Vue tooling config that governs editor checking.
2. Run a targeted Vue-aware typecheck for the website app to reproduce the editor error.
3. Fix the root cause, then rerun the relevant checks and record the result.
