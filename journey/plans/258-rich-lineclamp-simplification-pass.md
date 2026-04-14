# RichLineClamp simplification pass

## Goals

- Simplify the recent generation-scoped rich-image settlement implementation without changing its
  behavior.
- Keep the change local to `packages/vue-clamp/src/RichLineClamp.ts` and nearby browser tests.
- Preserve the existing shared boundary between `LineClamp` and `RichLineClamp`.

## Simplification targets

1. Remove ad hoc runtime state that is not pulling its weight.
2. Replace boolean-driven helper flow with explicit helper names where that improves readability.
3. Tighten the test helper model so it matches the real per-element image-settlement behavior.
4. Keep the resulting code easier to reason about than the current version.

## Plan

1. Refactor the rich-image tracking code in `packages/vue-clamp/src/RichLineClamp.ts` to use the
   smallest explicit state needed for:
   - stopping current tracking
   - collecting current pending images
   - scheduling one follow-up recompute after the current blocking set settles
2. Simplify the new browser tests in `packages/vue-clamp/tests/clamp.browser.test.ts`, including
   replacing the synthetic image-key completion helper with element-identity tracking.
3. Update `journey/design.md` and a matching log entry only if the simplification changes the
   canonical description or removes wording that no longer matches the code.
4. Validate with targeted `vp check` and browser tests.
