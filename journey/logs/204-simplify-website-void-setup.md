# 2026-04-07 Simplify website Void setup

- Confirmed `packages/website` is a plain Vue SPA:
  - no Void pages, routes, or middleware
  - no runtime imports from `void`
  - `voidPlugin()` was only affecting the build shape
- Removed `voidPlugin()` from the website Vite config so the site builds like a normal Vite SPA.
- Updated `packages/website/void.json` to keep `appType: "spa"` but point `outputDir` back to `dist`.
- Verified the new build output is the plain SPA layout:
  - `dist/index.html`
  - `dist/assets/*`
  - `dist/favicon.svg`
- Rebuilt locally with `vp run build -r`.
- Ran `vp check`; only the two pre-existing unused-helper warnings in `packages/vue-clamp/tests/demo-page.browser.test.ts` remain.
- Deployed locally with `cd packages/website && vp exec void deploy --skip-build`.
- Verified production after deploy:
  - `https://vue-clamp.void.app/` returns `200`
  - `https://vue-clamp.void.app/assets/index-JBQNjNMH.css` returns `200`
