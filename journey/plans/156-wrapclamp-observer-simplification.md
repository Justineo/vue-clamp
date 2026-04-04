# WrapClamp observer simplification

## Goal

Keep the useful observer dedupe in `WrapClamp`, but replace the current settled-layout-signature path with simpler and more direct bookkeeping.

## Direction

- Stop recomputing a whole root/content/before/after signature string inside the `ResizeObserver` callback.
- Track the currently observed elements directly.
- Snapshot settled sizes for those elements after each recompute.
- In the observer callback, compare only the delivered targets against their settled sizes.
- Sync the observed element set explicitly after mount and update.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp test -c vite.browser.benchmark.config.ts`
