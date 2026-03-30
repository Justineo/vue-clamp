# Review Follow-up Implementation

## Goal

Implement the three accepted follow-up items from the review discussion:

1. Fix middle-mode kept-count correctness.
2. Remove visible first-mount unclamped paint.
3. Move benchmark comparison code out of `packages/vue-clamp/src/`.

## Scope

- `packages/vue-clamp/src/clamp.ts`
- `packages/vue-clamp/src/VueClamp.ts`
- `packages/vue-clamp/tests/*.ts`
- `packages/vue-clamp/benchmark/**`
- `apps/website/src/benchmark/**`
- `apps/website/src/BenchmarkPage.vue`
- `journey/design.md`
- `journey/logs/026-review-follow-up-implementation.md`

## Plan

1. Fix the middle clamp split logic and update tests to reflect the corrected behavior.
2. Rework the first mount path so collapsed content does not visibly render unclamped text before the first measured result is ready.
3. Move benchmark comparison sources into `packages/vue-clamp/benchmark/` and update all imports.
4. Update the design snapshot to reflect the new behavior and file layout.
5. Validate with `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
