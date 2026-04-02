# 082 DOM Naive Simplification

## Goal

Switch the DOM-based entries back toward the naive Vue 2 model and remove guardrails that depend on measured line height.

## Steps

1. Simplify the default and legacy DOM entries.
   - Remove probe-based line-height fallback.
   - Remove derived collapsed `max-height`.
   - Remove hidden-first-paint readiness gating.
   - Keep only explicit `maxHeight` root clipping and the live DOM search behavior.
2. Update affected shared helpers, tests, and docs.
   - Drop DOM-entry assumptions that depend on hidden initial render or probe presence.
   - Preserve fast-path behavior and helpers that still need line-height/probe data.
3. Validate the simplified DOM paths.
   - `vp check`
   - `vp test`
   - `vp run test:browser`
   - `vp run build -r`
