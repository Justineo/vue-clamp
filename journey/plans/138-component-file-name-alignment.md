# Component file name alignment

## Goal

Align the component source filenames with the public component names:

- `LineClamp.ts`
- `InlineClamp.ts`
- `WrapClamp.ts`

## Why

- Makes the source tree match the public API.
- Reduces the mismatch between docs/discussion and actual file names.
- Keeps the component family visually aligned in the source directory.

## Scope

- Rename:
  - `packages/vue-clamp/src/component.ts` -> `packages/vue-clamp/src/LineClamp.ts`
  - `packages/vue-clamp/src/inline.ts` -> `packages/vue-clamp/src/InlineClamp.ts`
  - `packages/vue-clamp/src/wrap.ts` -> `packages/vue-clamp/src/WrapClamp.ts`
- Update current imports/exports and canonical memory references.
- Do not rewrite historical plan files unless needed.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
