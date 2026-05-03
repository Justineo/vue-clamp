# Module contract full scan log

## 2026-05-04

- Started a full pass over internal module contracts after simplifying rich fallback diagnostics.
- Scanned all `packages/vue-clamp/src` exports/imports and confirmed the root package surface still
  comes only from `index.ts` plus public declarations in `types.ts`.
- Removed duplicate component-file type re-exports from `InlineClamp.ts` and `WrapClamp.ts`.
- Kept `PreparedText`, `TextClampResult`, `PreparedRich`, and `RichState` exported because component
  modules use them as real cross-module state contracts; shortened purely local type names inside
  `text.ts`, `rich.ts`, and `multiline.ts`.
- Changed `clampTextToFit` to a named input object and updated `InlineClamp`, text tests, and the
  browser benchmark wrapper to match.
- Removed `splitGraphemes` and the exported search hint type; tests now validate grapheme
  preparation through `prepareText` instead of a test-only helper export.
- Narrowed `useMultilineClamp`'s recompute contract from the whole shell state object to only the
  shared expanded ref.
- Revisited object-parameter trade-offs for rich helpers: `patchRich` is back to a positional
  signature because it is called inside the rich search loop and has a stable, compact argument
  order; `clampRich` keeps a named options object because it is the cross-module entry point with
  probe, state, hint, and layout-limit fields.
- Validation passed: `vp check`, `vp test`, `vp run test:browser`, and `vp run build`. Browser
  tests still print the existing ResizeObserver loop warning, but all 81 browser tests pass.
