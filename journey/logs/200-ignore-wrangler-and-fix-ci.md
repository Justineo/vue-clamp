# 200 Ignore Wrangler output and fix CI

## 2026-04-07

- Investigated the skipped `Deploy Website` run for commit `d4c3ce8` and confirmed it was skipped
  only because the upstream `CI` workflow failed.
- Inspected the failing CI run (`24065029449`) with `gh run view --log-failed`.
- Confirmed the failure was in `vp run test:browser` with a startup error from the Cloudflare Vite
  plugin:
  - the browser-test config reused the website's full plugin list
  - the website now includes `voidPlugin()`
  - that plugin injects a Worker environment incompatible with the test config's SSR options
- Added `packages/website/vite.shared.ts` so the website can share Vue plugin + alias config
  without forcing test configs to inherit `voidPlugin()`.
- Updated `vite.browser.config.ts` and `vite.browser.benchmark.config.ts` to use the shared config
  instead of importing `packages/website/vite.config.ts`.
- Added `.wrangler/` to `.gitignore`.
- Removed `packages/website/.wrangler/deploy/config.json` from git with `git rm --cached` so the
  generated runtime state stays local-only.
