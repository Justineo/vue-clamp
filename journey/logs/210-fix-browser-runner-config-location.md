# 2026-04-08

- Reproduced the stall with a trivial smoke browser test, so the blocker was not the website app or the demo-page test file.
- Confirmed the package-local browser config path was the runtime problem:
  - `vp test run -c packages/website/vite.browser.config.ts ...` connected the browser session and tester but never started the test body.
  - an equivalent root config completed immediately for the same smoke test.
- Kept the earlier type-system fix in spirit, but changed the placement:
  - root browser configs now own the test runner entrypoints
  - they import only plain fragments from `packages/website/vite.shared.ts`
  - they do not import the website's typed `defineConfig(...)` object
- Added `@vitejs/plugin-vue` to the root `devDependencies` because the root package now legitimately owns the browser config scripts.
- Removed the package-local browser config files and the custom Playwright provider wrapper.
- Verified:
  - `CI=1 vp test run -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts`
  - `CI=1 vp run test:browser`
- The `ResizeObserver loop completed with undelivered notifications.` noise still appears through
  Vite's client error catcher during browser runs, but it is non-fatal and independent from the
  resolved config-location hang.
