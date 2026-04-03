# Source thorough review simplification

## Goal

Review the full `packages/vue-clamp/src` runtime line by line and remove state, branches, and repeated work that are not required to preserve the current browser-aligned contract.

## Review targets

- `LineClamp`:
  - replace mutable derived state with direct derivations where possible
  - collapse repeated limit / native-path checks into clearer invariants
  - keep the DOM-driven clamp pass intact unless a branch is demonstrably redundant
- `WrapClamp`:
  - trim recompute and render work that does not change outcomes
  - keep the settled observer / queue model unless a simpler path stays correct under slot-driven rerenders
  - remove avoidable per-render allocation where the visible prefix can be rendered directly
- `InlineClamp`:
  - remove reactive machinery if simple render-time derivation is enough
- shared helpers:
  - keep helper boundaries only where they materially improve readability or reuse

## Constraints

- Do not change public props, slots, emits, or exposed methods.
- Preserve browser-test behavior for native one-line clamping, DOM-trimmed accessibility, slot-driven reclamps, and wrap settling.
- Avoid extracting new tiny helper modules just to deduplicate a few lines.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/inline.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
