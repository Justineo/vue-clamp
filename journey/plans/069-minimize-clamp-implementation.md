# Minimize Clamp Implementation

## Goal

Reduce internal abstraction cost while preserving the dual-entry product surface:

- remove the formal engine layer
- keep `types.ts` focused on the public API
- let `vue-clamp` and `vue-clamp/fast` own their recompute closures directly
- keep only the shared shell that actually removes meaningful duplication

## Steps

1. Compare the current architecture against the Vue 2 baseline and identify removable abstraction.
2. Collapse the engine layer into direct entry-owned recompute closures.
3. Trim public/internal types and internal modules accordingly.
4. Update tests, docs, and benchmark consumers.
5. Run full validation.
