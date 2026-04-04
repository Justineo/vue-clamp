# WrapClamp thorough review simplification

## Goal

Review `WrapClamp` line by line and reduce the runtime to the minimum logic required to keep browser-aligned correctness, stable rerenders, and the current public contract.

## Direction

- Re-evaluate every recompute branch against actual correctness needs:
  - showing the full list
  - shrinking when the current prefix overflows
  - growing when hidden items may now fit
- Remove or collapse helper/state layers that only duplicate information or exist to support avoidable work.
- Keep live DOM measurement as the source of truth for visible-prefix decisions.
- Preserve the current `before` / `after` slot contract, exposed methods, and browser regressions.
- Prefer explicit control flow inside `WrapClamp.ts` over extra helper indirection.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
