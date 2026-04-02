# 041 Review Findings Implementation

## Goal

Address all five review findings while preserving runtime behavior exactly.

## Constraints

- No public API changes.
- No benchmark semantic changes.
- Keep the production clamp behavior and demo output the same.
- Prefer small shared helpers over large new abstractions.

## Work Plan

### 1. Shared benchmark support

Create a shared website-local benchmark support module to remove duplicated fixture and engine wiring from:

- `packages/website/src/benchmark/runBenchmarks.ts`
- `packages/website/src/BenchmarkScenarioPreview.vue`

Planned changes:

- Add a support module that owns:
  - benchmark engine order
  - engine labels/colors/runners
  - unique-text variant helper
  - DOM fixture builder
  - clamp-input builder
- Make the runner and preview consume the same support helpers instead of duplicating local copies.
- Centralize the only cross-package imports from `packages/website` into that support module.

### 2. Shared Pretext DOM adapter

Extract a single internal DOM-to-Pretext adapter in `packages/vue-clamp/src/` for measured clamp computation.

Planned changes:

- Add an internal helper that:
  - reads live DOM measurement inputs
  - resolves the prepared source
  - calls `computeClampText()`
  - returns measurement metadata needed by the component
- Use that helper in:
  - `packages/vue-clamp/src/component.ts`
  - `packages/vue-clamp/benchmark/pretext-dom.ts`

This should eliminate behavior drift between the production component and the benchmark Pretext path.

### 3. Shared DOM benchmark helpers

Reduce duplication between the DOM benchmark baselines.

Planned changes:

- Add `packages/vue-clamp/benchmark/dom/shared.ts`
- Move the shared display-text and DOM-fit helpers there
- Keep `legacy.ts` and `optimized.ts` focused on their distinct search logic only

### 4. Component cleanup

Refactor `packages/vue-clamp/src/component.ts` to make the clamp state machine easier to follow.

Planned changes:

- Extract the repeated unclamped/reset path into a helper
- Extract a clear bypass predicate for expanded/empty/unlimited cases
- Route measured clamp work through the shared DOM adapter
- Reduce repeated condition reconstruction in render where practical without changing behavior

### 5. Demo page simplification

Refactor `packages/website/src/App.vue` to remove repeated numbered state and repeated case markup.

Planned changes:

- Replace numbered `ref`s with named per-case state objects
- Extract shared form controls into a reusable component
- Extract repeated demo class/style helpers
- Keep the page content and interactions unchanged

## Validation

Run after the refactor:

- `vp check`
- `vp test`
- `vp run test:browser`

## Notes

- Update `journey/logs/` with the completed implementation summary.
- Update `journey/design.md` only if the effective architectural understanding changes, not for local cleanup alone.
