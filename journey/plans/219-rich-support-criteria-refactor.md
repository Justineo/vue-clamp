# Plan

## Goal

Replace `RichLineClamp`'s tag-name wrapper whitelist with a behavior-based support rule that stays
simple and documented.

## Steps

1. Refactor `packages/vue-clamp/src/rich.ts` so wrapper support is based on reconstructable light
   DOM plus computed inline layout, while keeping explicit special handling only for break and
   atomic elements.
2. Add browser coverage for behavior-based wrapper support, including inline custom elements and
   fallback for out-of-contract cases.
3. Update README, package README, website copy/demo, changelog, and `journey/design.md` so the
   shipped contract matches the runtime.
4. Run validation and record the decision in the journey log.

## Outcome

- Done on 2026-04-08.
- `RichLineClamp` wrapper support now follows behavior instead of a fixed wrapper tag list.
- Inline custom elements are supported when they expose reconstructable light DOM and render inline.
- Explicit special handling still stays narrow: `br`, `wbr`, atomic `img`, and outer `svg`.
