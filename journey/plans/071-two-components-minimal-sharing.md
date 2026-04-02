# Two Components With Minimal Sharing

## Goal

Replace the shared component shell with two standalone components for the default and fast entries, while extracting only the tiny pieces that are truly identical.

## Scope

- `packages/vue-clamp/src/component.ts`
- `packages/vue-clamp/src/fast.ts`
- minimal shared modules for props/emits and any tiny pure helpers
- remove the shared component shell if it becomes unnecessary
- update tests, design memory, and validation

## Steps

1. Identify the truly shared pieces: public types, props, emits, tiny pure helpers.
2. Rewrite `component.ts` as the standalone DOM-first component.
3. Rewrite `fast.ts` as the standalone Pretext-first component.
4. Delete the shared shell and any leftover abstraction that only existed to unify the two entries.
5. Run `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.

## Status

- Completed on 2026-04-01.
- `component-base.ts` was removed.
- Shared code was reduced to `component-shared.ts` plus existing pure helpers.
- Validation passed with `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
