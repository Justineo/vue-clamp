# 262 Rich structural simplification pass

## Changes

- Removed the redundant `clamped` field from rich clamp results; callers now derive clamped state
  from `decision.kind === "clamped"`.
- Removed the unused `html` field from `PreparedRichText`, left over from the old serialized
  result model.
- Limited trailing-whitespace trimming to clamped decisions so full-content commits preserve the
  original rich source.
- Removed the whole-subtree replacement fallback from structural patching; missing patch anchors
  are now treated as invariant failures instead of silently violating the new design.
- Kept the hidden probe and prefix-preserving suffix replacement model intact.

## Validation

- `vp check packages/vue-clamp/src/rich.ts packages/vue-clamp/src/RichLineClamp.ts packages/vue-clamp/tests/clamp.browser.test.ts packages/vue-clamp/tests/rich.browser.benchmark.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
- `vp run benchmark:rich`
- `vp check`
- `vp test`

The browser runs still print the existing `ResizeObserver` console noise and Shiki singleton
warning.
