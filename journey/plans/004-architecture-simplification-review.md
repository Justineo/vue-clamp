# Architecture Simplification Review

Date: 2026-03-29
Status: Proposed

## Goal

Decide whether the current Vue 3 + Pretext implementation is justified, identify where complexity is essential versus accidental, and define a concrete simplification plan that improves readability, maintainability, and confidence without discarding the new direction prematurely.

## Research Inputs

- Legacy implementation: `master:src/components/Clamp.js`
- Current implementation:
  - `packages/vue-clamp/src/VueClamp.ts`
  - `packages/vue-clamp/src/clamp.ts`
  - `packages/vue-clamp/src/index.ts`
  - `packages/vue-clamp/package.json`
- Tests:
  - `packages/vue-clamp/tests/VueClamp.test.ts`
  - `packages/vue-clamp/tests/clamp.test.ts`
  - `tests/setup.ts`
- Prior research: `journey/research/001-pretext-integration.md`

## Assessment Summary

- The Pretext direction is still reasonable.
- The current implementation is more complex than the legacy version in ways that are partly justified by:
  - TypeScript typing
  - Vue 3 render-function internals
  - browser measurement handling
  - start/middle/end clamp support
- But the codebase is not yet at a strong simplicity or maintainability bar.
- The main issue is not raw line count alone. The issue is that several kinds of complexity are concentrated in two files and some of that complexity is ad hoc:
  - state sync inside render
  - slot invocation outside render
  - wide public API for internal helpers
  - mixed responsibilities inside `VueClamp.ts`
  - mixed responsibilities inside `clamp.ts`
  - no repo-local benchmark or fallback strategy despite the research recommending phased delivery

## Priority Findings

### P1: Package metadata and public surface need tightening

- `packages/vue-clamp/package.json` points `types` and `exports["."].types` to `./dist/index.d.ts`, but the build emits `dist/index.d.mts`.
- `packages/vue-clamp/src/index.ts` publicly re-exports `computeClampText`, `resolveEffectiveMaxLines`, and internal computation types even though the legacy public contract is the component API.

### P1: The component still has framework-model smells

- `packages/vue-clamp/src/VueClamp.ts` invokes slot content at setup time to build `initialText`.
- The render function also queues `syncRawText()` as a side effect when slot text changes.
- Those patterns make the update model harder to reason about and are not idiomatic Vue internals.

### P2: `VueClamp.ts` is too responsibility-dense

- The file currently owns:
  - public prop and emit contract
  - text extraction
  - DOM measurement helpers
  - resize and font event orchestration
  - clamp scheduling
  - render tree generation
  - slot wrapper semantics
  - expanded/clamped state policy
- This is workable but not maintainable long term.

### P2: `clamp.ts` mixes policy, caching, line counting, and candidate search

- The file currently owns:
  - line-budget calculation
  - grapheme segmentation cache
  - Pretext prepared-text cache
  - decorated line counting
  - candidate string creation
  - binary search selection
- The names are mostly acceptable, but several are less precise than they should be:
  - `layoutDisplayText` really counts rendered lines
  - `offset` in `buildCandidate()` means kept grapheme count, not a source-text offset

### P2: The implementation overreaches relative to the research plan

- The research recommended:
  - phased rollout
  - text-first core
  - atomic slot model
  - likely dual-engine or fallback architecture
  - benchmarking before claiming the new engine is a net win
- The shipped code jumps to a single-engine universal path without:
  - benchmark evidence in this repo
  - runtime warnings for unsupported conditions
  - fallback handling

### P3: Documentation and observability are too thin for the current complexity

- Root README and package README do not explain:
  - supported CSS/text assumptions
  - atomic slot constraints
  - measurement caveats
  - why Pretext is worth the complexity
- There is also no benchmark harness or debug instrumentation to validate the added complexity.

## Simplification Plan

### Phase 0: Contract Hygiene and Low-Risk Cleanup

- Fix `types` and `exports` paths in `packages/vue-clamp/package.json`.
- Reduce the root public API to the component-facing contract.
- If clamp-engine helpers must remain available, move them behind an explicit secondary export such as `./internal` or keep them test-only.
- Expand `packages/vue-clamp/README.md` with the supported model and constraints.

### Phase 1: Remove Framework-Model Smells

- Eliminate slot invocation outside render for initialization.
- Eliminate render-time state synchronization side effects.
- Replace the current slot-text syncing model with an explicit post-render synchronization path that is easy to reason about and test.
- Goal: no state writes from render and no warnings about slot invocation context.

### Phase 2: Rebalance Modularization

- Keep the codebase small, but split by responsibility rather than by file count.
- Target shape:
  - `VueClamp.ts`: component contract, lifecycle wiring, render tree
  - `measurement.ts`: DOM/font/line-height/slot width helpers
  - `slot-text.ts`: plain-text extraction and normalization
  - `clamp.ts` or `clamp-engine.ts`: high-level clamp orchestration
  - optional `line-count.ts` if the decorated line-count logic remains dense
- Avoid over-fragmentation. The target is clearer boundaries, not many tiny files.

### Phase 3: Simplify the Clamp Engine Internals

- Rename ambiguous helpers and parameters:
  - `layoutDisplayText` -> `countRenderedLines`
  - `offset` -> `keptGraphemes` or `visibleGraphemeCount`
- Introduce small private value objects where they reduce parameter noise:
  - `MeasuredClampInput`
  - `SideSlotWidths`
- Review whether the extra component-layer caches still justify themselves on top of Pretext’s own cache behavior.
- Add short comments only around the hardest logic, especially first-line and final-line decorator handling.

### Phase 4: Narrow the Promised Model Before Adding More Features

- Explicitly document the supported zone:
  - plain-text default slot
  - atomic `before` and `after`
  - supported CSS/text assumptions
- Add dev-only warnings for clearly risky cases:
  - wrapped side-slot content
  - unsupported font configurations
  - impossible measurement states
- Prefer clearer constraints over hidden magic.

### Phase 5: Make the Architecture Decision With Evidence

- Add a small benchmark harness that compares:
  - many-instance mount cost
  - repeated width relayout cost
  - legacy DOM engine baseline versus current Pretext engine where possible
- Only after that decide whether to:
  - keep a simplified single-engine Pretext implementation
  - add a DOM fallback engine
  - introduce explicit engine selection
- Do not add fallback first. Clean up the current implementation and collect data before expanding architecture.

## Suggested Execution Order

1. Package metadata and public surface cleanup
2. Remove render-time state sync and slot invocation smells
3. Split `VueClamp.ts` by responsibility
4. Rename and simplify `clamp.ts`
5. Add docs, warnings, and benchmarks
6. Revisit fallback architecture only after evidence
