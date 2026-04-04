# WrapClamp defer-grow strategy

## Goal

Add a new `WrapClamp` strategy that responds immediately when the available space gets tighter, but defers growth recomputes during widening resize activity so the user can feel the difference in the stress-table demo.

## Direction

- Extend `WrapClamp` strategy values with a new resize-focused mode.
- Keep the core clamp search unchanged; change only how resize-driven recomputes are scheduled.
- On observed size changes:
  - if the current visible prefix no longer fits, recompute immediately
  - if the current visible prefix still fits but hidden items remain, debounce the growth recompute
- Keep prop/item/font-driven recomputes immediate.
- Add browser coverage for delayed growth and immediate shrink behavior.
- Expose the new mode in the table demo strategy switch and docs.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
