# Architecture Simplification Implementation

## Goal

Tighten the Vue 3 rebuild so the codebase is easier to read, safer to maintain, and closer to the original product contract without changing runtime behavior.

## Scope

- Fix package contract issues that currently leak internal implementation details or broken metadata.
- Remove Vue integration patterns that depend on setup-time slot invocation or render-time side effects.
- Split dense component internals into a small number of clearer modules.
- Improve internal naming where it materially reduces cognitive load.
- Expand documentation for supported usage constraints and architectural trade-offs.
- Validate with the existing checks and tests.

## Out of Scope

- Replacing the Pretext-based engine.
- Adding a fallback clamp engine.
- Adding performance benchmarks beyond documenting that they remain a follow-up item.
- Changing the public `0.4.1` component API.

## Action Plan

1. Contract hygiene
   - Fix `packages/vue-clamp/package.json` type export paths so they match the emitted `.d.mts` files.
   - Reduce the root package exports to the component-facing API and keep engine helpers internal.
   - Update package docs to describe the supported contract, constraints, and exposed instance API.

2. Vue integration cleanup
   - Replace setup-time slot text extraction with a render-driven source-text element.
   - Replace render-time queued text synchronization with post-render observation that preserves the no-flash behavior.
   - Keep the current reclamp scheduling guarantees and event semantics intact.

3. Responsibility split
   - Move DOM measurement helpers into a dedicated module.
   - Move source-text extraction helpers into a dedicated module.
   - Keep the component file focused on state, reactivity, and rendering.

4. Engine readability cleanup
   - Rename internal helpers and parameters in `clamp.ts` where names are currently misleading.
   - Avoid broad structural changes unless they clearly reduce complexity.

5. Verification and memory
   - Run `vp check`, `vp test`, and `vp run build -r`.
   - Update `journey/design.md` with the new architecture snapshot.
   - Record implementation notes and remaining follow-ups in `journey/logs/005-architecture-simplification-implementation.md`.

## Progress

- [x] 1. Contract hygiene
- [x] 2. Vue integration cleanup
- [x] 3. Responsibility split
- [x] 4. Engine readability cleanup
- [x] 5. Verification and memory
