# Vocabulary

This file defines shared terms for `WrapClamp` solver design notes, plans, benchmarks, and
implementation comments. Use these terms consistently so discussions do not blur public rendering,
DOM measurement, prediction, and final correctness.

## Core State

- `public DOM`: The component-owned DOM that represents the user-facing component instance.
- `public render path`: Vue state and render output that produce the public DOM.
- `public commit`: A Vue state write that changes user-facing output, such as assigning
  `visibleCount.value`.
- `steady state`: The component state after settlement completes. It must not contain speculative
  candidate state.
- `visible count`: The public semantic item boundary. `hiddenItems` is derived from this count.
- `committed visible count`: The currently rendered public `visibleCount`.
- `candidate`: A temporary visible-count value considered by a solver.
- `speculative state`: Any candidate state that has not passed verification.
- `verified count`: A candidate count accepted only after live DOM verification.
- `clamped state`: Whether the verified visible count is less than the source item count.

## Solver Flow

- `settlement`: The whole process of moving from the current state to a verified count.
- `baseline solver`: The current conservative visible-DOM solver: measure public DOM, public-commit
  candidate changes when necessary, and settle by shrinking or growing.
- `fast path`: A narrower solver branch that attempts to reduce work before falling back to, or
  verifying with, the baseline solver.
- `hint`: A prediction used to choose a better first candidate. A hint is not a correctness proof.
- `measurement`: Any layout read used during solving.
- `verification`: The final live DOM check before accepting a count.
- `fallback`: Returning to the baseline solver. This is a normal correctness mechanism, not a
  failure.
- `mismatch`: A fast path prediction or DOM-search result that final verification rejects.
- `confidence`: Runtime trust in a fast path or metrics source, lowered by mismatches.

## DOM And Rendering

- `item shell`: The component-owned wrapper around one source item, currently
  `[data-part="item"]`.
- `affix`: A `before` or `after` slot shell that participates in the same wrap flow as items.
- `no-affix`: A case with neither `before` nor `after` slot.
- `materialize`: Make item shells exist in DOM.
- `materialized count`: Number of item shells currently present and available for measurement or
  candidate mutation.
- `mounted hidden suffix`: Materialized item shells beyond the public visible count, hidden from
  layout or visibility.
- `candidate mutation`: Synchronous direct DOM changes used to test a candidate without a Vue public
  commit, such as toggling shell `display`.
- `DOM search`: Candidate mutation plus layout reads over materialized DOM.
- `measurement island`: A non-public DOM area used for measurement.
- `hidden Vue probe`: A rejected general measurement-island strategy that duplicates arbitrary Vue
  slot DOM and changes candidates inside that duplicate tree.

## Measurement Data

- `metrics`: Layout data derived from a verified or otherwise bounded DOM state.
- `item metrics`: Per-item shell size data.
- `line map`: Mapping from item indexes to measured visual lines.
- `last-line slack`: Remaining inline space on the final accepted line.
- `frontier`: The interval around the fit/overflow boundary, for example `13..21` when `13` fits
  and `21` overflows.
- `chunk`: A batch of newly materialized item shells.
- `measurement budget`: Limits for a settlement pass, such as max new items, rect reads, slot calls,
  or elapsed time.

## Safety

- `paint-safe`: Candidate states cannot be painted. Any candidate mutation must finish and restore
  or commit a verified state before yielding to the browser.
- `stale paint`: A browser paint of an old or speculative clamp state.
- `public DOM ownership`: Vue owns the public DOM. Direct DOM mutation must be short-lived,
  synchronous, and compatible with the next Vue patch.
- `steady-state DOM semantics`: What DOM exists after settlement. Hidden or materialized suffixes
  can affect selectors, refs, ids, lifecycle, images, form state, and accessibility even if they are
  visually hidden.

## Slot Categories

- `stable affix`: A `before` or `after` slot whose rendered geometry does not depend on
  `hiddenItems` or candidate count for the current fingerprint.
- `count-sensitive after`: An `after` slot that changes with `hiddenItems`, such as `+N`.
- `dynamic before`: A `before` slot that changes with `hiddenItems` or candidate count. It is more
  dangerous than dynamic `after` because it appears before items in the wrap flow.
- `arbitrary slot`: A slot whose output, geometry, side effects, or count sensitivity cannot be
  bounded by the solver.

## Important Distinctions

- `materialize` is not `visible`: an item shell can exist in DOM without being part of the public
  visible count.
- `hint` is not `proof`: metrics can choose a candidate, but final acceptance requires
  verification.
- `measurement` is not `verification`: verification is the final acceptance check.
- `public commit` is not `candidate mutation`: public commit changes Vue state; candidate mutation
  is internal synchronous DOM work.
- `fallback` is not failure: it is how fast paths preserve correctness.
