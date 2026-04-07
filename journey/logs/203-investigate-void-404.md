# 2026-04-07 Investigate Void production 404

- Confirmed `https://vue-clamp.void.app/` was returning a platform `404` for `/`, `/index.html`, `/favicon.svg`, and the built asset URLs.
- Verified the latest CI run for commit `61d5682` reported a successful `Static SPA deploy`, but it did not use the framework-aware `dist/client/` output.
- Checked the local build output and Void docs:
  - the website build writes deployable static HTML/assets to `packages/website/dist/client/`
  - without an explicit `void.json`, `void deploy --skip-build` falls back to generic static preset inference
  - that inference was treating the website as a plain static SPA rooted at `dist/`
- Added `packages/website/void.json` to declare the intended static deploy shape explicitly:
  - `inference.appType: "spa"`
  - `inference.outputDir: "dist/client"`
- Plan after config change:
  - rerun the local deploy with the same `vp exec void deploy --skip-build` command CI uses
  - verify the live hostname serves the site again
  - push the fix so future CI deploys use the correct output root
