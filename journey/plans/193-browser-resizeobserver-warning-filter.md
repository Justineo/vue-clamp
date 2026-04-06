# 193 Browser ResizeObserver warning filter

## Goal

Keep the runtime clamp behavior unchanged while removing the known Chromium
`ResizeObserver loop completed with undelivered notifications.` flood from browser-test output.

## Steps

1. Add a browser-test setup file that intercepts only the known ResizeObserver warning.
2. Wire that setup file into `vite.browser.config.ts`.
3. Document the test-harness decision in `journey/design.md`.
4. Run the browser test suite to confirm the warning no longer floods the output.
