# 2026-04-07 Investigate browser config type root cause

- Confirmed the regression window:
  - `86c0623` was green
  - `4193658` was the first red run
  - `vite.browser.config.ts` and `vite.browser.benchmark.config.ts` did not change between them
- Built a compiler-level repro for the old explicit `const config: UserConfig = { ... }` shape.
- The repro showed the actual mismatch:
  - `playwright()` resolved `BrowserProviderOption` from
    `@voidzero-dev/vite-plus-test@...(@types/node@24.12.0)...`
  - `UserConfig.test.browser.provider` resolved from a second
    `@voidzero-dev/vite-plus-test@...(@types/node@25.5.0)...`
- Traced that split back to pnpm importer-local installs:
  - the workspace root declared `@types/node`
  - `packages/vue-clamp` and `packages/website` did not
  - both package importers therefore got their own `vite-plus` symlinks with `@types/node@25.5.0`
- Fix direction:
  - add `@types/node: "catalog:"` to the package-level `devDependencies`
  - reinstall so every `vite-plus` importer resolves against the same peer set
  - restore the explicit `UserConfig` annotations after the type graph is aligned
- Verification also exposed a separate runtime mismatch in the shared browser config:
  - the website footer now loads logos from `packages/website/public`
  - the shared browser configs were reusing the website plugin and aliases, but not the website
    `publicDir`
  - adding `publicDir: "packages/website/public"` restored `vp run test:browser`
