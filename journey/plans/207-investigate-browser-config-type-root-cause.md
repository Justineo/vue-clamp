# Investigate browser config type root cause

## Goal

Understand why the explicit `UserConfig` typing in the browser config files started failing in CI after the `void` dependency graph cleanup, then fix the actual source instead of relying on pure inference as a workaround.

## Background

- Commit `86c0623` passed CI with:
  - `vite.browser.config.ts` typed as `const config: UserConfig = { ... }`
  - `vite.browser.benchmark.config.ts` typed the same way
- Commit `4193658` was the first red run after removing the private `void` package from the workspace graph.
- The browser config files themselves did not change between those two commits.
- CI then started failing on:
  - `TS2321` around `const config: UserConfig = { ... }`
  - `TS2322` around `provider: playwright()`

## Hypothesis

- The dependency graph cleanup changed type identity or package resolution for the Vitest browser provider types.
- That made the explicit top-level `UserConfig` annotation brittle in CI, even though the runtime config stayed valid.
- The proper fix is either:
  - to target the correct narrower type at the right location, or
  - to fix the type mismatch source so the explicit config remains valid.

## Plan

1. Compare the dependency/type environment between the last green and first red commits.
2. Inspect the relevant `vite-plus`, `@vitest/browser`, and Playwright provider type declarations.
3. Identify the exact mismatch and implement the minimal correct fix.
4. Re-run CI-equivalent validation and document the cause clearly in `journey/`.
