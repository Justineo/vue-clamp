# Pretext Optimization And Benchmark Overhaul

## Goal

Redesign the current Pretext-based clamp engine so it actually exploits Pretext's strengths, while removing redundant logic and avoiding repo-local caches that merely duplicate optimizations Pretext already performs internally.

In parallel, expand the benchmark suite so it can evaluate the redesigned engine across realistic clamp workloads, not just the current narrow scenario set.

## Scope

- Optimize the Pretext-based clamp path used by the package.
- Keep the public Vue component API compatible with `0.4.1`.
- Remove avoidable hot-path work in the current Pretext integration.
- Add a broader benchmark suite covering engine-level and component-level workloads.
- Use the benchmark suite as the primary gate for deciding whether the redesigned Pretext path is a real improvement.

## Non-Goals

- Reverting the package to a DOM-based production engine.
- Introducing broad repo-local caches whose only purpose is to mirror Pretext's internal segment metric caches.
- Adding speculative abstraction layers before benchmark evidence justifies them.
- Turning the benchmark suite into a synthetic microbenchmark disconnected from how the component is actually used.

## Constraints

- Only cache data whose lifetime and invalidation model are not already handled by Pretext.
- Preserve current product constraints:
  - plain-text default slot
  - `before` and `after` treated as atomic inline boxes
  - `start`, `middle`, and `end` locations remain supported
  - `maxLines` and `maxHeight` remain supported
  - no-flash collapsed updates remain supported
- Prefer simpler algorithms when they deliver the same measured result.
- Do not optimize the engine and the benchmark in a way that makes them mutually dependent or unfair.

## Optimization Principles

### 1. Use Pretext as a prepared-text engine, not a candidate-string oracle

- Prepare source text once per stable `(normalized text, font, whitespace semantics)` tuple.
- Reuse that prepared handle across width-only changes.
- Invalidate the prepared handle only on text or font changes, not on every clamp recomputation.

### 2. Remove hot-path work that does not contribute to the result

- Stop materializing line text when only ranges, widths, or line counts are needed.
- Stop re-segmenting source text into graphemes on every recompute when the source text is unchanged.
- Stop rebuilding full candidate strings for search paths that can be expressed in terms of prepared ranges and cursors.

### 3. Keep caching honest

- Allow only caches with clear ownership and invalidation:
  - per-instance prepared source handles
  - per-instance derived source segmentation when it cannot be recovered cheaply from the prepared handle
  - per-benchmark-run instrumentation summaries
- Do not reintroduce repo-global caches for:
  - segment widths
  - grapheme width metrics
  - measurement primitives already cached by Pretext internally

### 4. Optimize by location and operation type, not by forcing one generic path

- `end` clamp is the most natural fit for a cursor/range-based Pretext algorithm and should become the primary optimized path.
- `start` and `middle` should be reevaluated separately rather than forced through the same candidate-building strategy if that creates avoidable work.
- Width-only relayout, text changes, and slot-width changes should each have explicit invalidation rules.

### 5. Benchmark the actual bottlenecks

- Distinguish between:
  - width-only recompute with unchanged text
  - text replacement with stable width
  - slot-width changes
  - large batches with repeated texts
  - large batches with unique texts
- Measure both engine-only cost and component integration cost.

## Workstreams

## Workstream A: Baseline Audit

### A1. Map current hot-path work precisely

- Enumerate all current Pretext-path work per recompute:
  - DOM reads
  - source normalization
  - full-text fit test
  - grapheme segmentation
  - candidate generation
  - `prepareWithSegments()` calls
  - line-walk calls
  - final display assembly
- Mark each step as:
  - unavoidable
  - avoidable
  - avoidable only for width-stable or text-stable paths

### A2. Identify which work is ours vs Pretext's

- Separate:
  - work we explicitly trigger in `clamp.ts`
  - work Pretext performs inside `prepareWithSegments()`
  - work Pretext already caches internally
- Use this audit to prevent duplicate repo-local optimizations.

### A3. Define allowed state ownership

- Document what state may live:
  - in the Vue component instance
  - in the clamp engine instance or closure
  - only inside Pretext

Deliverable:

- A short architecture note appended to `journey/logs/010-pretext-optimization-and-benchmark-overhaul.md`.

## Workstream B: Benchmark Overhaul

### B1. Split the benchmark suite into two tiers

- Tier 1: engine-level benchmark
  - direct clamp engine calls on DOM fixtures
  - minimal framework noise
- Tier 2: component-level benchmark
  - actual `<vue-clamp>` instances
  - realistic update scheduling, observers, and DOM lifecycle

### B2. Expand scenario coverage

- Text classes:
  - short text that fits
  - medium English paragraph
  - long English paragraph
  - CJK paragraph
  - mixed English + CJK
  - emoji-heavy text
  - mixed RTL/LTR sample
  - long unbroken token or URL
  - whitespace-heavy or punctuation-heavy text
- Clamp shapes:
  - `end`
  - `start`
  - `middle`
  - `maxLines = 1`
  - `maxLines = 2`
  - `maxLines = 3`
  - larger `maxLines`
  - `maxHeight`-only
- Slot shapes:
  - no slots
  - `before` only
  - `after` only
  - both slots
  - `after` width changes between clamped and expanded states
- Operation classes:
  - initial clamp
  - width shrink
  - width expand
  - width oscillation
  - text replacement
  - text append/remove
  - slot-width change
  - no-op recompute with unchanged inputs
- Scale classes:
  - single instance
  - small batch
  - large batch
  - repeated identical texts across many instances
  - mostly unique texts across many instances

### B3. Improve measurement quality

- Run multiple macro-runs per scenario and report:
  - median
  - min/max
  - geometric mean for suite-level comparison
- Keep engine order rotation, but also support repeated order permutations or seeded shuffling.
- Record environment metadata:
  - browser
  - OS
  - DPR
  - language
  - font
- Add optional CPU-throttled or busy-loop background load mode only if it produces stable additional insight.

### B4. Add correctness comparators

- Report not just time, but also:
  - clamped/unclamped agreement
  - displayed text agreement where exact match is expected
  - documented intentional divergence for grapheme-aware cases
- For the production engine, add component-level visual/behavior assertions for key scenarios.

### B5. Add instrumentation counters

- Count per engine:
  - prepare calls
  - line-walk calls
  - candidate evaluations
  - text mutations
  - DOM width or style reads
- Use these counters as explanatory diagnostics, not as a benchmark score by themselves.

Deliverables:

- Updated benchmark runner and page
- Bench result schema that stores richer statistics and counters
- Logged benchmark environments and result summaries in `journey/logs/`

## Workstream C: Pretext-next Experimental Engine

### C1. Introduce a benchmark-only `pretext-next` engine first

- Build the redesigned Pretext engine inside the benchmark harness before replacing the production engine.
- Keep the current Pretext engine as a separate benchmark baseline until the new one proves itself.

### C2. Source preparation lifecycle

- Hold one prepared source handle per stable source text and font.
- Keep its invalidation minimal:
  - text change
  - font change
  - any future white-space-mode change if introduced
- Keep width changes off this invalidation path.

### C3. Replace line-text materialization with range walking

- Remove hot-path use of `layoutNextLine()` where line text is not required.
- Use range-oriented Pretext APIs for:
  - line counting
  - line widths
  - last visible line boundary detection

### C4. Separate full-text fit from truncation search

- Reuse the prepared full text for the full-fit check.
- Do not rebuild source-level segmentation or preparation if full text already fits.

### C5. Remove candidate-string search where Pretext can operate on prepared state

- For `end` clamp:
  - use prepared ranges/cursors as the primary search space
  - derive the truncation boundary from visible-line geometry rather than repeatedly preparing candidate strings
- For `start` clamp:
  - evaluate a range-based or transformed-source strategy
  - only keep a candidate-string fallback if it is measurably simpler and not materially slower
- For `middle` clamp:
  - treat as a separate problem
  - benchmark whether a prepared-range algorithm is worth its complexity
  - keep a clearly isolated fallback path if the more advanced approach is not justified

### C6. Keep output assembly minimal

- Assemble the final displayed string only once the winning boundary is known.
- Avoid intermediate candidate string materialization unless the chosen search strategy requires it.

### C7. Keep slot handling explicit but narrow

- Continue treating `before` and `after` as atomic widths.
- Ensure slot-width changes invalidate only layout, not source preparation.

Deliverable:

- A fourth benchmark engine: `pretext-next`

## Workstream D: Production Integration

### D1. Replace the current Pretext engine only after benchmark proof

- Promote `pretext-next` into the package only after it clearly beats the current Pretext engine and is materially competitive in the targeted real-world scenarios.

### D2. Keep production state small and explicit

- Store only:
  - prepared source handle
  - current measurement inputs
  - minimal invalidation flags
  - final clamp result
- Remove helpers or caches that were only compensating for the old candidate-string strategy.

### D3. Keep no-flash behavior while simplifying recompute flow

- Width-only changes should reuse prepared state and recompute quickly enough to preserve the current no-flash guarantees.
- Text changes should invalidate only what actually depends on text.

### D4. Revisit location-specific complexity after integration

- If `middle` or `start` still need fallback logic, isolate that clearly instead of contaminating the `end` hot path.

Deliverables:

- Updated production clamp engine
- Updated component integration
- Removed obsolete logic from the current Pretext path

## Workstream E: Validation And Acceptance Gates

### E1. Correctness gates

- Existing unit and component tests must pass.
- New tests must cover:
  - width-only relayout reuse
  - text invalidation
  - slot-width invalidation
  - location-specific correctness
  - no-flash guarantees on resize and text updates

### E2. Performance gates

- `pretext-next` must beat the current Pretext engine in all major scenario families.
- `pretext-next` should beat the optimized DOM benchmark in the scenarios Pretext is supposed to own:
  - width-only repeated relayout on unchanged text
  - repeated identical texts across many instances
  - multi-instance relayout with stable text and changing widths
- If it still loses badly on text-update-heavy workloads, document that explicitly rather than hiding it.

### E3. Simplicity gates

- No repo-local cache may be added without:
  - a defined ownership scope
  - explicit invalidation rules
  - evidence that Pretext does not already solve the same problem internally
- Prefer deleting logic over relocating it.
- Keep benchmark-specific instrumentation out of the production hot path.

### E4. Validation commands

- `vp check`
- `vp test`
- `vp run build -r`
- real-browser benchmark run(s) recorded in `journey/logs/`

## Execution Order

1. Overhaul benchmarks enough to measure the redesign fairly.
2. Build `pretext-next` in the benchmark harness first.
3. Use benchmark evidence to choose the simplest winning algorithm per location.
4. Integrate the proven design into production.
5. Remove obsolete logic and rerun the full benchmark + validation suite.

## Success Criteria

- The production Pretext path no longer re-prepares source text on width-only changes.
- The hot path no longer materializes line text when only ranges or widths are needed.
- The benchmark suite can distinguish:
  - width-bound workloads
  - text-mutation workloads
  - slot-width workloads
  - repeated-text vs unique-text workloads
- The final implementation is simpler than the current Pretext path in the places that matter:
  - fewer avoidable preparations
  - fewer avoidable allocations
  - fewer avoidable line-walk costs
  - clearer invalidation rules

## Progress

- [x] Redesign the production Pretext path around per-instance prepared source reuse.
- [x] Remove unnecessary hot-path work in the production engine where exported Pretext APIs allow it.
- [x] Preserve the old Pretext integration as a benchmark baseline.
- [x] Expand the engine-level benchmark suite with broader scenarios, macro-runs, counters, and four-engine comparison.
- [ ] Add the component-level benchmark tier.
