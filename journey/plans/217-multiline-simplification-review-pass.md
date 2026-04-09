# Plan

## Goal

Do a second simplification pass on the multiline runtime after the `LineClamp` / `RichLineClamp`
split and file-layout cleanup.

## Focus

- Remove anything that is not truly necessary.
- Simplify internal module and function contracts.
- Eliminate duplicated and redundant logic where the replacement stays obviously smaller.
- Avoid adding a new hidden shell or framework-like abstraction.

## Steps

1. Simplify `text.ts` and `rich.ts` return contracts where the extra result object shape is not
   pulling its weight.
2. Extract the duplicated queued recompute loop into one tiny shared helper if it reduces code in
   `LineClamp`, `RichLineClamp`, and `WrapClamp` without obscuring ownership.
3. Replace duplicated `normalizeLineLimit` / `sizeSignature` helpers in `WrapClamp` with the shared
   `layout.ts` versions.
4. Remove duplicated helper logic in the browser test utilities where the production helper can be
   reused directly.
5. Run the full validation set and update `journey/design.md` plus the session log with the final
   simplification decisions.

## Outcome

- Done on 2026-04-08.
- Kept the public split (`LineClamp` and `RichLineClamp`) intact.
- Simplified the remaining internal contracts instead of adding another shell:
  - clamp helpers now return the rendered value directly where possible
  - one tiny queued-task helper replaces three local recompute loops
  - leftover helper duplication in `WrapClamp` and browser tests was removed
