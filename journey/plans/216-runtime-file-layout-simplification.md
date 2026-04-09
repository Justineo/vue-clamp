# Plan

## Goal

Collapse the transitional multiline helper files into clearer domain files after the clean
`LineClamp` / `RichLineClamp` split.

## Steps

1. Merge the rich clamp engine into `packages/vue-clamp/src/rich.ts`.
2. Merge the text clamp engine plus text-only native helpers into
   `packages/vue-clamp/src/text.ts`.
3. Replace the vague `lineClampShared.ts` file with a tiny `packages/vue-clamp/src/layout.ts`
   that contains only the genuinely shared measurement helpers.
4. Remove the transitional `lineClampShared.ts`, `lineClampText.ts`, and `lineClampRich.ts`
   files.
5. Revalidate the workspace and update `journey/design.md` with the final runtime file layout.
