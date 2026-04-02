# Demo Style Unification

## Visual Thesis

Both component demos should read like one calm technical reference system: same outer rhythm, same label hierarchy, same preview language, with only the inner behavior changing between multiline and inline cases.

## Content Plan

1. Keep the current demo content and controls.
2. Tighten the inline comparison layout so it feels like part of the same demo family as `LineClamp`.
3. Reuse the same width-guide language instead of introducing another visual treatment.

## Interaction Thesis

1. No new interactions.
2. Preserve the existing shared width control for `InlineClamp`.
3. Make the comparison easier to scan by improving hierarchy, not by adding new chrome.

## Implementation Plan

1. Refine the inline demo markup in `packages/website/src/App.vue` to use comparison panels with the existing `data-inline-mode` hooks intact.
2. Replace the old row-specific inline styles with a simpler shared comparison panel system.
3. Validate with `vp check`, `vp test`, and `vp run test:browser`.
