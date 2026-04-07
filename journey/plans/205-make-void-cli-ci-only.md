# Make Void CLI CI-only

## Goal

Remove the private `@void-sdk/void` package from the normal workspace dependency graph so routine installs do not depend on GitHub Packages, while keeping website deployment to Void working in CI.

## Why

- The website is now a plain Vue SPA and no longer needs `void` for build-time or runtime integration.
- The `void` package is only used for deployment commands.
- Keeping it in `packages/website` forces normal installs, lockfile resolution, and dependency automation to touch a private GitHub Packages dependency unnecessarily.

## Plan

1. Remove `void` from the website package and workspace catalog.
2. Update `packages/website/void.json` so it no longer assumes a local `node_modules/void/schema.json`.
3. Change CI deploy steps to install and run a pinned `@void-sdk/void` version via `vp dlx` only on `main` deploys.
4. Remove GitHub Packages auth from normal install workflows and keep it only around the deploy-time `vp dlx` steps.
5. Reinstall, verify the build/check flow, and confirm the pinned `vp dlx` command still works.
