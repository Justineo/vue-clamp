# Modern browser simplification

## Goal

Simplify the current source surface by removing guard logic and fallbacks that are no longer justified for the project's browser baseline.

## Changes

- Remove `ResizeObserver` existence checks from `LineClamp` and `WrapClamp`.
- Remove optional event-listener fallbacks around `document.fonts`.
- Normalize `LineClamp` limit checks the same way `WrapClamp` already does.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp test -c vite.browser.benchmark.config.ts`
