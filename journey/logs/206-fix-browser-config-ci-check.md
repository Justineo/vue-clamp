# 2026-04-07 Fix browser config CI check failure

- Reproduced the red `CI` run for commit `fac0be2` by inspecting GitHub Actions run `24073935216`.
- Verified the failing step was `vp check`, not the footer changes.
- The concrete errors were CI-only TypeScript failures in:
  - `vite.browser.config.ts`
  - `vite.browser.benchmark.config.ts`
- Root cause: both files forced the config object through an explicit `UserConfig` annotation, which triggered deep structural type comparisons around the browser provider shape in CI.
- Fix:
  - removed the explicit `UserConfig` imports
  - changed both files to let `defineConfig(...)` infer the config object instead
- Verification:
  - `vp exec tsc --noEmit`
  - `vp check`
  - remaining output is only the two existing unused-helper warnings in `packages/vue-clamp/tests/demo-page.browser.test.ts`
