# Broader runtime simplification pass

## Goals

- Continue simplifying the clamp runtime where the remaining indirection is not earning its keep.
- Keep the current architecture intact: shared multiline shell plus local component clamp logic.
- Prefer fewer single-use wrappers and more direct code only when readability improves.

## Scope

- `packages/vue-clamp/src/RichLineClamp.ts`
- `packages/vue-clamp/src/WrapClamp.ts`
- `packages/vue-clamp/src/multiline.ts`

## Plan

1. Remove low-value single-use helpers that are now more noise than structure, especially:
   - `pendingRichImages()` in `RichLineClamp`
   - `slotPropsForCount()` and tiny runner wrappers in `WrapClamp`
   - `frameElements()` and tiny runner wrappers in `multiline.ts`
2. Keep wrappers that still package meaningful behavior instead of mere forwarding.
3. Update journey notes only if this changes the canonical runtime description.
4. Run `vp check`, `vp test`, and browser tests because the shared multiline shell is in scope.
