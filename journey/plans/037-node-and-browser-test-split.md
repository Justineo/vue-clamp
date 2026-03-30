# Node And Browser Test Split

## Goal

Run all DOM-dependent tests in a real browser and keep only pure unit tests in Node. Remove the old jsdom-based setup and any direct dependencies that only existed to support it.

## Why

- The component now depends on real layout, measurement, and browser rendering behavior.
- jsdom-based component tests are not a trustworthy approximation for clamp correctness.
- The repo already has a browser suite; the next simplification is to make that the only home for rendered DOM tests.
- Pure engine tests do not need a DOM at all and should stay fast in Node.

## Target Split

### Node

- `packages/vue-clamp/tests/engine.test.ts`

### Browser

- `packages/vue-clamp/tests/clamp.browser.test.ts`
- `packages/vue-clamp/tests/width-sweep.browser.test.ts`

## Implementation Steps

1. Replace the VTU/jsdom component tests with browser-native mounting helpers based on Vue `createApp`.
2. Rename the component suite to `*.browser.test.ts`.
3. Keep the root `vite.config.ts` Node-only and exclude `*.browser.test.ts`.
4. Keep `vite.browser.config.ts` as the dedicated browser suite config.
5. Delete `tests/setup.ts` once nothing uses it.
6. Remove direct `@vue/test-utils` and `jsdom` dev dependencies if the rewrite no longer needs them.
7. Update scripts/docs so the expected validation flow is explicit.

## Acceptance

- No direct jsdom dependency remains in the workspace config or package dev dependencies.
- No direct `@vue/test-utils` dependency remains unless a browser-native need still justifies it.
- Rendered/component tests run only in the browser suite.
- Engine tests run only in Node.
- `vp test`, `vp run test:browser`, `vp check`, and `vp run build -r` all pass.
