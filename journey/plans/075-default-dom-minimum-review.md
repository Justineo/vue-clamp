# 075 Default DOM Minimum Review

## Goal

Identify what can still be simplified in the default DOM-based component while preserving:

- browser-faithful clamping
- current correctness guarantees
- acceptable runtime performance

## Review Scope

1. Compare the current default DOM component with the Vue 2 baseline.
2. Separate true guardrails from implementation-driven complexity.
3. Identify simplifications that are:
   - safe now
   - safe with targeted follow-up tests
   - too risky without a larger model change

## Working Findings

- The core DOM search path is already reasonably minimal: live same-context measurement plus binary search in `packages/vue-clamp/src/component.ts`.
- The remaining complexity is concentrated in update coordination rather than the clamp search itself.
- The current deferred/coalesced reclamp model is the main source of secondary guardrails such as derived collapsed clipping.
- The default and fast entries still duplicate a large amount of lifecycle and scheduling code, but that duplication is not necessarily bad if the entries continue to diverge semantically.

## Questions To Answer

1. Which pieces are still accidental complexity?
2. Which pieces are necessary only because of the current scheduling model?
3. Which tiny shared composables, if any, are still worth extracting?

## Outcome

- Simplify the default DOM entry by removing the deferred `queueMicrotask()` reclamp path.
- Keep immediate recompute in post-render hooks, `ResizeObserver`, and font-ready callbacks.
- Drop the default entry's shared clamp-mode/render-state helper usage and keep that branching local.
- Keep the derived collapsed clipping guardrail because browser tests still prove it is required after width shrink.
