# Fix browser config CI check failure

## Goal

Restore the `CI` workflow after `vp check` started failing in GitHub Actions on the browser config files.

## Evidence

- The latest run for commit `fac0be2` is failing in the `vp check` step.
- The failing files are:
  - `vite.browser.config.ts`
  - `vite.browser.benchmark.config.ts`
- The reported errors are:
  - `TS2321` around `const config: UserConfig = { ... }`
  - `TS2322` around `provider: playwright()`

## Hypothesis

- The explicit `UserConfig` annotations are forcing TypeScript to compare a very deep inferred object shape against the Vite+ config type.
- CI's environment is tripping over that comparison while local `vp check` is not surfacing it consistently.
- Letting `defineConfig(...)` infer the config object should avoid the brittle comparison and keep the config behavior unchanged.

## Plan

1. Remove the explicit `UserConfig` annotations from both browser config files.
2. Keep the config contents the same and export them through `defineConfig(...)`.
3. Re-run the local checks and push the fix once the browser config typing issue is resolved.
