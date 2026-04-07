# Fix browser config shared boundary

## Goal

Remove the unstable cross-package type boundary between the root browser configs and the website
Vite config so CI stops seeing intermittent `BrowserProviderOption` incompatibilities.

## Background

- The root browser configs currently import `packages/website/vite.config.ts`.
- That file exports a `defineConfig(...)` result typed through the website package's own importer-local
  `vite-plus` install.
- The root browser configs are typed through the root importer-local `vite-plus` install.
- CI can therefore compare "same version, different physical instance" types and fail with
  `TS2322` around `playwright()`.

## Plan

1. Move the browser-specific Vite configs under `packages/website/` so the website package owns the
   Vue plugin and config typing boundary.
2. Keep any shared website config fragments package-local and stop importing website-owned Vite
   config through the repo-root importer.
3. Align package manifests with the new dependency ownership, regenerate the lockfile, and rerun
   `vp check`, `vp test`, and browser/build verification.
