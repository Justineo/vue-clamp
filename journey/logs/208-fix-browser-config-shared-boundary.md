# 2026-04-08 Fix browser config shared boundary

- Investigated the recurring `vp check` CI failures on the browser config files after `ed0c7c6`.
- Confirmed the original `TS2322` root cause was a monorepo ownership problem, not the tab-style
  revert:
  - the repo-root browser configs were typed through the root importer-local `vite-plus` install
  - they also depended on website-owned Vite config/plugin state
  - TypeScript could therefore compare "same version, different physical instance" types across the
    root and `packages/website` importer boundaries
- Tried a root-level shared config fragment first. That removed the direct config-object import, but
  keeping the browser configs at the repo root still left root-owned plugin/config typing fragile
  and exposed a separate `TS2321` stack-depth failure around `const config: UserConfig = { ... }`.
- Moved the browser configs to `packages/website/` so the website package owns all website-specific
  Vite config:
  - `packages/website/vite.browser.config.ts`
  - `packages/website/vite.browser.benchmark.config.ts`
  - `packages/website/vite.shared.ts`
- Updated the root scripts to point at the package-local config files and removed the unnecessary
  root `@vitejs/plugin-vue` dependency.
- Verification after the move:
  - `vp install`
  - `vp check` passes with the same two pre-existing unused-helper warnings in
    `packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `vp test` passes
  - `vp run build -r` passes
- `vp run test:browser` did not return cleanly through the current tool runner after the move, so
  browser-mode revalidation still needs a normal local shell or CI run even though the TypeScript
  failure in `vp check` is resolved.
