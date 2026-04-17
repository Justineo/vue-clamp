# Node And Browser Test Split

## 2026-03-30

- Confirmed the current component suite still depends on `@vue/test-utils`, `tests/setup.ts`, mocked `ResizeObserver`, mocked `clientWidth`, mocked `getBoundingClientRect`, and jsdom-oriented mount attributes.
- Chosen direction: rewrite the component suite for the browser runner instead of trying to keep VTU/jsdom semantics alive.
- Target steady state:
  - Node: pure engine tests only
  - Browser: all rendered/component tests
- Replaced the old VTU/jsdom component suite with browser-native mounting based on Vue `createApp`.
- Added shared browser test helpers in `packages/vue-clamp/tests/browser.ts`.
- Renamed the component suite to `packages/vue-clamp/tests/clamp.browser.test.ts`.
- Kept the sweep suite in `packages/vue-clamp/tests/width-sweep.browser.test.ts` and moved it onto the shared browser helpers.
- Root `vite.config.ts` now runs Node tests only, with a tiny `OffscreenCanvas` shim in `tests/node-setup.ts` for Pretext measurement.
- Removed the old jsdom setup file and the direct `@vue/test-utils` / `jsdom` package dependencies.
