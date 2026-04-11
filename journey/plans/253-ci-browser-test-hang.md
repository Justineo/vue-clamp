# CI browser test hang

## Goals

- Identify why `vp run test:browser` hangs in GitHub Actions.
- Reproduce the hang locally or isolate the CI-only condition.
- Apply the narrowest fix that restores reliable browser-test completion in CI.

## Plan

1. Inspect the browser-test config, workflow steps, and recent runtime/test changes that could affect CI behavior.
2. Reproduce the browser-suite behavior locally with targeted logging and time bounds, then compare that with GitHub Actions evidence.
3. Fix the root cause, rerun the most relevant local validation, and record the CI-hang outcome in journey notes.
