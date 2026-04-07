# Simplify website Void setup

## Goal

Remove unnecessary Void-specific build behavior from `packages/website` while keeping the site deployable to Void.

## Why

- The website is a plain Vue SPA with no Void pages, routes, middleware, or SSR features.
- `voidPlugin()` changes the build shape into a split `dist/client` + `dist/ssr` output tree.
- That extra shape already caused one deploy regression because the deploy step had to know about `dist/client`.
- A plain SPA build should be simpler to reason about and should deploy from the standard `dist/` directory.

## Plan

1. Remove `voidPlugin()` from the website Vite config.
2. Keep the `void` package only for the CLI used by deployment.
3. Update `packages/website/void.json` so the deploy target is the plain SPA output in `dist/`.
4. Verify with local build/check commands and a real `void deploy --skip-build`.
