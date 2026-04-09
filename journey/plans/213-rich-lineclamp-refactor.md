# Plan

## Goal

Refactor the current rich-text `LineClamp` implementation toward a clearer internal architecture
without reopening the shipped regressions. Keep the current public `LineClamp` entry point and
main recompute workflow intact during the first passes, then extract only the complexity that is
actually shared or meaningfully separable.

## Refactor direction

- Keep `LineClamp` as the public multiline shell while the refactor is in flight.
- Keep visible-DOM measurement as the default direction for now:
  - it matches the current workflow
  - it preserves style fidelity
  - a hidden probe does not solve stale committed overflow after width shrink by itself
- Split text and rich clamping into distinct internal engines with a thin shared shell.
- Treat a public `RichLineClamp` surface as an optional later extraction, not the first step.

## Target end state

- `LineClamp.ts` owns only:
  - public props and emits
  - shared refs
  - shared recompute scheduling
  - shared fit checks and layout invalidation
  - final render and exposed methods
- Text and rich modes clamp through separate internal engines with explicit contracts.
- Rich mode remains intentionally narrow:
  - trusted `html`
  - end truncation only
  - current supported inline subset only
  - unchanged fallback behavior for unsupported source or rendered layout
- Recompute triggers and guarantees are documented from first principles:
  - same-flush reactive layout changes
  - observer-driven async layout changes
  - font and image driven relayout
- Public API stays stable unless a later pass makes a strong case for adding `RichLineClamp`.

## Non-goals

- Do not widen rich mode into arbitrary VNode or structural HTML truncation.
- Do not introduce a detached off-document probe.
- Do not chase a large generic clamp abstraction that hides the browser-driven differences between
  text and rich modes.
- Do not promise a stronger overflow guarantee than the runtime actually provides without adding an
  explicit clip strategy.

## Steps

1. Lock the current behavior with tests.
   - Expand browser coverage around the current rich path before restructuring internals.
   - Keep permanent tests for:
     - supported inline rich truncation
     - unsupported-source fallback
     - unsupported-rendered-layout fallback
     - image-driven reclamping
     - same-flush width shrink regression
     - `location` warnings in `html` mode
     - dual `text` + `html` warning behavior
   - Add any missing assertions that distinguish:
     - stale committed overflow after resize
     - temporary candidate mutations during a clamp pass

2. Define explicit internal clamp engine contracts.
   - Introduce mode-specific internal result shapes so `LineClamp` stops coordinating ad hoc text
     and html branches inline.
   - The shell should ask an engine for a logical clamp result, then commit that result.
   - The result contract should cover:
     - committed payload
     - `clamped` boolean
     - optional warning/fallback reason
     - no-op / reset cases
   - Keep the shared shell responsible for applying reactive state and emitting events.

3. Separate source preparation from committed render state.
   - Keep prepared source as derived data from props, not as mutable runtime state.
   - Keep committed render state as the minimum visible payload:
     - `visibleText`
     - `renderedHtml`
     - `isClamped`
     - `expanded`
   - Ensure every recompute starts from the prepared full source, not from previously clamped DOM.
   - Make the distinction explicit between:
     - source of truth
     - candidate being measured
     - final committed result

4. Extract the text and rich engines behind the same shell.
   - Move mode-specific clamping logic out of `LineClamp.ts`.
   - Keep text-specific logic with the text helpers and rich-specific logic with the rich helpers.
   - Keep shared browser-layout helpers small and explicit:
     - limit normalization
     - fit checks
     - layout signature
     - maybe the recompute queue if it stays truly shared
   - Prefer a small amount of duplication over a generic engine interface that obscures behavior.

5. Simplify the rich engine while preserving the current workflow.
   - Keep visible-DOM measurement initially.
   - Make the engine lifecycle explicit:
     - validate prepared rich source
     - validate rendered layout for the supported subset
     - binary-search kept units against the live body
     - leave the live body in the final measured candidate before returning
     - commit once through the shared shell
   - Reduce incidental complexity in the rich path where possible:
     - isolate validation from binary search
     - isolate materialization from scheduling
     - keep fallback reasons centralized

6. Simplify recompute scheduling and invalidation.
   - Replace scattered recompute triggers with a documented invalidation model.
   - Keep one queued recompute loop per instance.
   - Preserve both same-flush and async resize coverage:
     - `onUpdated` for layout changes that happen inside the component's own Vue update cycle
     - `ResizeObserver` for external async geometry changes
   - Keep font and image invalidation explicit and localized.
   - Remove any resets or intermediate reactive writes that are only there to help the current
     mixed implementation work.

7. Reduce `LineClamp.ts` back to a readable shell.
   - After engine extraction, `LineClamp.ts` should read in this order:
     - props and emits
     - refs and reactive state
     - shared helpers
     - invalidation and recompute wiring
     - render
   - Centralize dev warnings so mode-specific constraints are easy to inspect.
   - Keep comments sparse and only where the lifecycle guarantee is not obvious from the code.

8. Re-evaluate public surface splitting after the internals are clean.
   - Once the internal rich engine is isolated, decide whether adding `RichLineClamp` is worth the
     extra public surface.
   - Use this decision rule:
     - add `RichLineClamp` only if it materially clarifies docs, types, and maintenance
     - otherwise keep one public component with separate internal engines
   - Do not block the internal cleanup on this decision.

9. Update documentation and design memory only when decisions settle.
   - Update `journey/design.md` after each accepted architectural decision.
   - Update README, demos, and changelog only if the public contract changes.
   - If the public API does not change, keep the docs update focused on implementation notes and
     maintainership clarity rather than user-facing churn.

10. Validate after each refactor slice.

- Run:
  - `vp check`
  - `vp test`
  - targeted browser tests for `LineClamp`
  - `CI=1 vp run test:browser`
- If measurement behavior changes materially, rerun the relevant benchmark path before calling
  the refactor complete.

## Execution checkpoints

### Checkpoint A: test lock

- Current behavior is covered well enough to refactor safely.
- No implementation changes yet beyond test additions or clarifications.

### Checkpoint B: engine split

- `LineClamp.ts` no longer contains the full text and rich clamp algorithms inline.
- Shared scheduling still behaves exactly as before.

### Checkpoint C: scheduler cleanup

- Recompute invalidation is easier to reason about.
- Same-flush and async resize behavior are both still covered by tests.

### Checkpoint D: public-surface decision

- Decide whether to keep one public `LineClamp` or add `RichLineClamp`.
- Only make this change if it lowers long-term complexity rather than just moving it around.

## Risks to watch

- Width shrink in the same Vue flush and width shrink from external async resize are different
  timing cases and should stay tested separately.
- Rich layout validation must not accidentally bless partially unsupported rendered DOM.
- Engine extraction must not reintroduce stale committed overflow or warning duplication.
- If visible-DOM measurement stays in place, the implementation should be explicit about which
  temporary DOM mutations are acceptable and why.
