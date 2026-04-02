# 095 API And Feature Brainstorm

## Goal

Evaluate realistic next-step API and feature improvements for `vue-clamp` without losing the current product goal: one simple browser-aligned clamp component whose core clamped source is still easy to reason about.

## Current Constraint Snapshot

- The clamp algorithm works on one source string from `text`.
- The runtime can only clamp by rewriting one text node or by using the narrow native single-line overflow path.
- `before` and `after` are supported because they are treated as atomic inline boxes outside the clamped source text.
- The current surface was intentionally simplified away from default-slot text extraction to avoid VNode text collection and synchronization complexity.

## Questions

1. Should the package stay string-first and only add narrow ergonomic improvements?
2. Is there a constrained non-string content model that preserves the current implementation philosophy?
3. Is full rich-text support worth the runtime and maintenance cost, or should it be a separate experimental surface?

## Evaluation Criteria

- Keeps the implementation readable from the component file
- Preserves browser-aligned fit decisions
- Keeps accessibility understandable
- Minimizes render-time VNode introspection and mutation logic
- Avoids turning one component into multiple overlapping clamp engines

## Directions To Evaluate

### A. Keep `text` as the only clamped source

- Add only ergonomic improvements that do not change the core content model.
- Candidate additions:
  - richer clamp state payloads
  - an optional explicit clamp strategy prop
  - improved imperative/exposed diagnostics
  - slot naming or slot API cleanup if justified

### B. Add a restricted inline-content model

- Support a new prop such as `segments` or `items` instead of arbitrary slot content.
- Possible rules:
  - plain text runs remain clampable
  - non-text items are atomic inline boxes
  - the engine can drop trailing items, but it does not split them internally
  - ellipsis likely needs to become renderable content, not just a string prop
- This is meaningfully more complex than `text`, but still much smaller than full rich text.

### C. Support full rich text

- Restore clamped-source content from rendered VNodes or a default slot.
- To preserve markup, the runtime would need to:
  - flatten inline content into a measurable logical stream
  - map clamp cut points back into nested VNode boundaries
  - re-render partial trees with inserted ellipsis content
  - maintain accessible full content separately from visible rewritten content
  - keep native single-line behavior coherent with the richer model
- This is effectively a second product tier, not a small extension.

## Working Recommendation

1. Keep `Clamp` string-first as the stable core.
2. If non-string content is important, prefer a second constrained API such as `segments` rather than reopening the default slot.
3. Treat full rich text as a separate experimental component or package entry only if there is strong product demand.

## Desired Output From This Brainstorm

- A ranking of feasible improvements
- A recommendation on whether rich text belongs in the core component
- A decision on whether to explore a constrained inline-content API
