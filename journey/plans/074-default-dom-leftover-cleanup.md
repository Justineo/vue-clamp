# Default DOM Leftover Cleanup

## Goal

Remove leftover structure from the default DOM implementation after the live-search rewrite, while keeping only the guardrails that are still backed by browser tests.

## Scope

- `packages/vue-clamp/src/component.ts`
- `packages/vue-clamp/src/engine-dom.ts`
- `packages/vue-clamp/benchmark/dom/default.ts`
- `journey/design.md`

## Steps

1. Remove the remaining `engine-dom.ts` module boundary.
2. Flatten the DOM search result handling in the default component.
3. Keep the derived collapsed clipping inputs (`lineHeight`, `boxHeightOffset`) because they are still required by the resize regression.
4. Re-run validation and update journey memory.

## Status

- Completed on 2026-04-01.
- `engine-dom.ts` was removed.
- The default DOM component now owns its live search directly.
- Validation passed with `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
