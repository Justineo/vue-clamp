# 2026-04-08 Browser provider init-script cleanup

- Revisited the browser ResizeObserver warning suppression because the browser config file still
  carried a large inline `PlaywrightBrowserProvider` patch.
- Re-checked the local `@voidzero-dev/vite-plus-test` implementation and confirmed:
  - `setupFiles` is still too late
  - the Playwright provider exposes an `initScripts` array that the browser server injects into the
    test HTML before the app/tester scripts
- Replaced the inline `openBrowserPage()` monkey patch with:
  - `packages/website/test/resize-observer-error-filter.ts`
  - `packages/website/test/playwright-provider.ts`
- The local provider helper now wraps the exported `playwright()` provider option and overrides only
  `providerFactory`, returning a subclass that appends the filter script to `initScripts`.
- Browser config files are back to small declarative config objects.
- Verification:
  - `vp check` passes with the two pre-existing unused-helper warnings in
    `packages/vue-clamp/tests/demo-page.browser.test.ts`
  - the running Vitest browser server serves
    `/@fs/.../packages/website/test/resize-observer-error-filter.ts`, confirming the script is
    available through the injected provider hook
