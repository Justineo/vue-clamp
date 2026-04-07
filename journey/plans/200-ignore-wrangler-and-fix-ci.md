# Ignore Wrangler output and fix CI

## Goal

Remove generated Wrangler state from version control and restore GitHub Actions CI after the
website adopted the Void Vite plugin.

## Observed issues

- `packages/website/.wrangler/deploy/config.json` is generated deployment state and should not be
  tracked.
- The latest `CI` workflow failed in `vp run test:browser`.
- The startup error reports the Cloudflare Vite plugin rejecting `resolve.external` in the `ssr`
  environment.
- `vite.browser.config.ts` currently imports `packages/website/vite.config.ts` and reuses its
  `plugins`, which now include `voidPlugin()`.

## Plan

1. Ignore `.wrangler/` and remove the tracked generated file from git.
2. Decouple browser-test config from the website's full plugin list, or otherwise gate the Void
   plugin out of the Vitest browser environment.
3. Run targeted verification (`vp run test:browser` at minimum).
4. Update journey notes and push the fix.
