# RichLineClamp workflow simplification

Date: 2026-04-17

## Goal

Simplify `RichLineClamp` by removing redundant local workflow/state, aligning it with the current `LineClamp` + `useMultilineClamp` pattern, and preserving the rich clamp behavior unless a clear bug falls out of the simplification.

## Plan

1. Compare `RichLineClamp`, `LineClamp`, `multiline.ts`, and rich clamp helpers to identify duplicated or inconsistent state transitions.
2. Remove component-local helpers or data passing that merely restates shared shell behavior.
3. Keep rich-specific logic local only where it directly handles prepared rich DOM, probe DOM, fallback, or patch decisions.
4. Update journey design notes only if the effective design changes.
5. Run `vp check` and `vp test` after the patch.
