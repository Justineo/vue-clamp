# Extract Public Types

## Goal

Move declaration-only public types into `packages/vue-clamp/src/types.ts` without adding new behavior or extra abstraction.

## Steps

1. Create `src/types.ts` for the public declaration-only types.
2. Update component, clamp, benchmark, and root exports to import those types from the new module.
3. Keep engine-local internal types in `clamp.ts`.
4. Update the design snapshot and run `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
