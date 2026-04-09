# Plan

## Goal

Choose the most maintainable long-term architecture for multiline rich-text clamping after the
initial `LineClamp html` implementation and the first internal engine split.

## Options evaluated

### Option A: one public `LineClamp` with one shared shell and two internal engines

Description:

- Keep `LineClamp` as the only multiline public component.
- Keep `text` and `html` as two modes on the same component.
- Continue separating internal text and rich engines, but keep one shell for props, scheduling,
  state, render, warnings, and slots.

Strengths:

- Smallest public API.
- No migration for current `html` users.
- No compatibility wrapper needed.

Weaknesses:

- The component keeps carrying two different contracts:
  - text supports `location`
  - rich supports end-only truncation
- The render path, warnings, types, docs, and invalidation model stay mode-conditional.
- Future rich changes still risk regressions in text mode and vice versa.
- The shared shell gradually becomes the new complexity sink even if the engines are clean.

Conclusion:

- Good transitional architecture.
- Not the most maintainable end state.

### Option B: separate public `LineClamp` and `RichLineClamp` built on a large shared shell

Description:

- Add a new public `RichLineClamp`.
- Keep a shared base shell for scheduler, render structure, state wiring, slot plumbing, warnings,
  and possibly engine hooks.

Strengths:

- Public contracts become clearer than Option A.
- Some duplication is avoided.

Weaknesses:

- The large shared shell becomes an internal framework.
- Both components become harder to read because behavior is split across abstraction layers.
- Rich and text rendering still have to fit the shell's shape rather than their own natural shape.
- Debugging ownership gets worse: bugs belong half to the shell and half to a mode adapter.

Conclusion:

- Better public API than Option A, but worse internal maintainability than necessary.
- Not recommended.

### Option C: separate public `LineClamp` and `RichLineClamp` with only small shared utilities

Description:

- `LineClamp` becomes text-only again.
- `RichLineClamp` becomes html-only and end-only.
- Shared logic stays as plain helpers:
  - fit checks
  - size signatures
  - maybe a very small recompute queue helper if it remains obviously identical
  - shared slot and exposed types where appropriate

Strengths:

- Each component has one coherent contract.
- Render logic, accessibility model, warnings, and docs stay local to the component that owns them.
- Rich-specific changes stop perturbing the text component.
- Text-only optimizations remain easy to reason about.
- Rich fallback rules remain explicit instead of being threaded through text-oriented code.

Weaknesses:

- Public API grows by one component.
- There is some duplication in scheduler and shell code.
- The current `LineClamp html` users need a compatibility story.

Conclusion:

- Highest clarity and lowest long-term cognitive load.
- Recommended end state.

## Decision

Choose Option C:

- separate public `LineClamp` and `RichLineClamp`
- keep shared logic small and functional
- avoid a large shared shell

## Why this is the most maintainable choice

1. The text and rich contracts are meaningfully different.

- Text mode supports:
  - `text`
  - start/middle/end or ratio truncation
  - hidden full-text accessibility fallback
  - native one-line fast path
- Rich mode supports:
  - trusted `html`
  - end truncation only
  - supported inline subset and rendered-layout validation
  - raw-html fallback when out of contract

These are not two variants of the same feature. They are two different components that happen to
share some DOM measurement primitives.

2. The shell is exactly where mixed-mode complexity accumulates.

- scheduling
- warnings
- render branching
- prop validation
- docs and types
- mode-specific accessibility behavior

Even after extracting the engines, the remaining shared shell is still where the text and rich
differences collide. Keeping one public component means keeping this mixed responsibility forever.

3. Small duplication is cheaper than a permanent abstraction tax.

The codebase already prefers local clarity over framework-like internal abstraction. A duplicated
`onUpdated` or `ResizeObserver` wiring block in two small components is cheaper than one base shell
that every future reader has to mentally parameterize.

4. Public clarity matters for maintenance too.

The current `LineClamp` docs have to explain that:

- `html` is trusted
- rich mode is end-only
- `location` still exists but does not really apply
- `text` and `html` are mutually exclusive

That is a documentation smell caused by an overloaded component contract. A dedicated
`RichLineClamp` makes the contract self-evident from the name and props alone.

## Chosen compatibility strategy

Do not break users immediately.

### Phase 1: add `RichLineClamp` and move the real rich implementation there

- Introduce a public `RichLineClamp`.
- Keep `LineClamp` public and text-first.
- Keep `LineClamp html` working for compatibility, but make it a thin compatibility path that
  delegates to `RichLineClamp` instead of hosting the rich engine itself.

### Phase 2: narrow `LineClamp` types and docs gradually

- Document `RichLineClamp` as the preferred component for rich content.
- Keep `LineClamp html` documented as compatibility behavior for one release cycle.
- Avoid immediate deprecation noise unless there is a clear release policy for it.

### Phase 3: remove `html` from `LineClamp` in the next major, if desired

- Only do this after `RichLineClamp` is stable and the migration path is well documented.

## Target component ownership

### `LineClamp`

Owns:

- text-only props
- native one-line fast path
- JS text clamp path
- text accessibility fallback
- text-specific warnings and docs

Does not own:

- rich parsing
- rich validation
- rich fallback behavior

### `RichLineClamp`

Owns:

- `html`
- end-only rich truncation
- supported rich subset contract
- rendered-layout validation
- raw-html fallback behavior
- rich-specific warnings and docs

Does not own:

- text location ratios
- text accessibility duplicate source node
- native one-line text-overflow optimization

### Shared utilities only

Keep shared:

- `fitsContent`
- `sizeSignature`
- `normalizeLineLimit`
- maybe a tiny recompute queue helper if both components truly end up identical there
- shared slot prop and exposed method types where it improves consistency

Do not share:

- render shell
- mode dispatch
- warning layer
- engine interfaces that exist only to preserve a common shell

## Recommended implementation order

1. Introduce `RichLineClamp` with the current rich engine and rich render path.
2. Keep `LineClamp` text-only internally.
3. Make `LineClamp` delegate to `RichLineClamp` only when `html` is passed.
4. Split public types so `RichLineClamp` has its own props type.
5. Update docs and demos to prefer `RichLineClamp`.
6. Keep compatibility coverage for `LineClamp html` until the project decides on a major-version
   removal.

## Acceptance criteria

- A new contributor can open `LineClamp.ts` and see only text clamping concerns.
- A new contributor can open `RichLineClamp.ts` and see only rich-html concerns.
- The docs no longer need to explain away mixed-mode prop contradictions as a normal path.
- Shared code remains obviously shared, not abstracted for its own sake.
