# 098 Expensive Work Minimization Plan

## Goal

Reduce avoidable clamp work to the bare minimum while preserving the current product contract:

- one DOM-driven component
- browser-truth fit decisions
- `before` / `after` atomic inline slots
- native single-line end-ellipsis fast path when eligible
- no speculative second engine

This plan focuses on removing repeated work across reclamps and shrinking the cost of each candidate evaluation.

## Research Summary

### Current hot path shape

The current JS clamp path still does the following on each non-native recompute:

1. normalize `location`
2. enter `clampText()`
3. read root styles and geometry
4. segment the full source text
5. binary-search `kept`
6. for each candidate:
   - build a candidate string
   - write it into the live DOM
   - read layout rects from the browser
   - count lines and/or test visible height

### Concrete avoidable work in the current implementation

1. **Dead width computation**
   - `clampText()` currently computes parsed padding/border/width values, but only uses the result to decide whether width is `<= 0`.
   - The computed width is not otherwise used in the clamp algorithm.
   - This is pure overhead and should be replaced by a smaller visibility/positive-width guard.

2. **Repeated source preparation for unchanged text**
   - `splitGraphemes(text)` runs once per `clampText()` call, not once per text change.
   - Width-only, slot-only, and font-only reclamps still resplit the same source text.

3. **Repeated candidate string materialization**
   - `displayTextForKeptCount()` currently rebuilds candidate strings from segmented text on every search step.
   - That work is repeated even when only layout changed.

4. **Full-range binary search on every reclamp**
   - The current algorithm forgets the previous winning `kept` count.
   - Layout-only reclamps restart from:
     - full-text fit probe
     - full binary search range
   - This wastes DOM writes and layout reads.

5. **Duplicate rect work inside `fits()`**
   - `getClientRects()` is called separately for `maxHeight` and line-limit checks.
   - Rect arrays and derived structures are rebuilt per candidate.

6. **No recompute dedupe**
   - Resize, slot, and font events can all trigger reclamps.
   - There is no exact-input fast path or layout-signature dedupe to skip repeated identical recomputes.

7. **Observer-triggered recompute churn**
   - `ResizeObserver` directly calls `recompute()`.
   - That keeps behavior simple, but it can produce multiple expensive reclamps for the same settled layout.

## Optimization Principles

1. **Separate stable source work from unstable layout work**
   - Text segmentation should be invalidated by text changes, not by width changes.

2. **Keep the browser as the fit oracle**
   - We should not replace DOM fit checks with a modeled layout engine.
   - The optimization target is fewer DOM candidate probes, not fewer correctness guarantees.

3. **Prefer narrow per-instance caches over global caches**
   - Cache only what clearly belongs to a component instance and has obvious invalidation.

4. **Exploit monotonicity**
   - For fixed text, policy, and layout semantics, “does this `kept` fit” remains monotonic.
   - Width/slot/font changes should search around the previous answer, not from scratch.

5. **Optimize in measurement-backed phases**
   - Start with instrumentation and low-risk removals.
   - Delay speculative or architecture-heavy steps until counters show where the real cost remains.

## Proposed Runtime Model

### 1. Prepared source cache

Hold one prepared source object per current `text`:

- `text`
- `graphemeCount`
- prepared grapheme boundaries
- any source-mode marker needed for fast slicing

This cache is invalidated only when `props.text` changes.

### 2. Prepared placement policy

Prepare and cache stable non-layout policy inputs:

- normalized `locationRatio`
- `ellipsis`
- native-vs-JS eligibility inputs that do not require live DOM width

This cache is invalidated by:

- `location`
- `ellipsis`
- `maxLines`
- `maxHeight`
- `expanded`

### 3. Layout signature

Track the minimum set of live inputs that actually affect fit:

- root inline size or equivalent usable width signal
- root visible height when `maxHeight` applies
- observed `before` size
- observed `after` size
- text style / font readiness generation when fonts can change wrapping

This is not a global cache key. It is a per-instance last-layout fingerprint used to skip exact duplicates.

### 4. Last clamp result

Persist the last successful clamp result:

- `kept`
- `visibleText`
- `clamped`
- mode (`native` vs `js`)

This lets the next reclamp start from the previous answer instead of from the full range.

## Recommended Workstreams

## Workstream A: Measurement And Instrumentation

Before deeper changes, add low-noise counters around the production path:

- `recompute` count
- `splitGraphemes` count
- candidate evaluations per reclamp
- DOM text writes per reclamp
- `getClientRects()` calls per reclamp
- exact-duplicate reclamps skipped vs executed
- native-path vs JS-path counts

### Benchmark scenarios to add or keep

- initial mount
- width shrink with unchanged text
- width grow with unchanged text
- repeated same-width no-op recompute
- slot appearance/disappearance
- font-ready follow-up reclamp
- ASCII paragraph
- CJK paragraph
- mixed paragraph
- ratio locations other than `1`

### Why this comes first

- It prevents us from over-optimizing the wrong part.
- It will show whether the dominant cost is:
  - source preparation
  - string building
  - DOM writes
  - layout reads
  - trigger duplication

## Workstream B: Remove Purely Wasted Work

These changes are low-risk and should land first.

### B1. Remove dead width parsing

Replace the current parsed-width computation in `clampText()` with the minimum positive-size guard actually needed.

Preferred shape:

- check whether the relevant rendered box has usable width
- bail early if it does not
- do not parse root `width`, padding, border, and box-sizing unless those values become algorithmically necessary again

### B2. Unify rect collection per candidate

Inside `fits()`:

- call `getClientRects()` once
- filter usable rects once
- derive both:
  - line count
  - max-height visibility test

from the same rect snapshot

### B3. Make no-op state writes impossible

Keep or strengthen guards so reclamp does not reassign:

- `visibleText`
- `nativeTextOverflow`
- `isClamped`

when the next primitive value is equal

This is a small win, but it lowers rerender churn and makes later counters easier to trust.

## Workstream C: Prepared Source Cache

This is the highest-value source-level optimization.

### C1. Move segmentation ownership out of `clampText()`

Prepare the source once when `text` changes and store it in instance state.

`clampText()` should receive prepared source data rather than raw `text`.

### C2. Prefer boundary offsets over grapheme arrays

Instead of storing an array of grapheme strings only, store grapheme boundaries into the original text.

Why:

- candidate rendering can use `text.slice(...)`
- avoids repeated `array.slice(...).join("")` work per candidate
- keeps source memory compact
- works for both ASCII and segmented Unicode text

Suggested prepared shape:

- `text`
- `graphemeCount`
- `boundaryOffsets`, where offset `i` is the code-unit index after the first `i` graphemes

Then candidate rendering becomes:

- prefix end offset from `boundaryOffsets[prefix]`
- suffix start offset from `boundaryOffsets[graphemeCount - suffix]`
- render from original `text.slice(...)`

### C3. Keep ASCII as a preparation fast path, not a special runtime branch everywhere

The ASCII-safe detector remains useful, but its job should be:

- build trivial boundary offsets quickly for ASCII
- avoid `Intl.Segmenter` for ASCII text

After preparation, rendering should use the same offset-driven code path where possible.

## Workstream D: Result-Guided Search

This is likely the biggest layout-path win after source caching.

### D1. Reuse the previous `kept`

On layout-only reclamps:

1. test the previous `kept` first
2. if it still fits:
   - search upward only
3. if it no longer fits:
   - search downward only

This immediately cuts the search space on width oscillation and repeated resizes.

### D2. Stop probing full text blindly on every reclamp

The current full-text fit probe is useful on first clamp and fresh text changes, but it is wasteful on many layout-only updates.

Preferred rule:

- fresh text or policy change:
  - allow the full-text fit probe
- layout-only change with previous JS result:
  - probe previous `kept` first
  - only probe full text if the narrowed search proves the clamp can expand all the way

### D3. Preserve monotonic correctness

This optimization is safe only when the following are unchanged from the previous result:

- source text
- ellipsis
- normalized ratio
- DOM wrapping semantics relevant to the text

If those change, fall back to the full search path.

## Workstream E: Exact-Input Fast Path And Recompute Dedupe

This reduces duplicate work from trigger churn.

### E1. Introduce a per-instance exact-input cache

Cache the last effective clamp inputs and result:

- prepared source version
- layout signature
- policy signature
- result

If the same effective inputs arrive twice, return the cached result without rerunning search.

### E2. Coalesce observer-triggered reclamps conservatively

Do not jump straight to `requestAnimationFrame` batching unless browser tests prove it does not reintroduce stale frames.

Safer first step:

- keep immediate response semantics
- but dedupe repeated observer/font-triggered calls against the exact-input cache

### E3. Revisit observer registration churn

`watchPostEffect()` currently rebuilds the observed list and reattaches observers as refs/slots change.

This is acceptable for simplicity, but after bigger wins land, re-evaluate whether:

- root observation
- before observation
- after observation

can be managed with a more stable registration lifecycle

## Workstream F: Candidate Rendering Cost Reduction

Once prepared source offsets exist, further reduce candidate cost.

### F1. Keep rendering string assembly branch-light

Prefer one generic renderer with only two edge fast paths:

- suffix-only preserve
- prefix-only preserve

### F2. Trim only the edge adjacent to the ellipsis

Keep trimming behavior localized:

- `trimEnd()` on prefix
- `trimStart()` on suffix

and avoid broader normalization passes

### F3. Avoid rebuilding identical candidate text

The current `currentText` guard is useful and should remain.

Once result-guided search exists, many reclamps should write fewer distinct candidates into the DOM.

## Proposed Implementation Order

1. Instrument counters and benchmarks.
2. Remove dead width parsing and unify rect reads.
3. Add prepared source caching.
4. Convert prepared source to boundary offsets for cheap candidate rendering.
5. Add previous-result-guided search.
6. Add exact-input cache and duplicate-trigger skipping.
7. Reassess whether observer scheduling changes are still needed.

## Validation Plan

### Functional

- existing `vp test`
- existing `vp run test:browser`
- targeted new tests for:
  - no re-segmentation on width-only reclamp
  - cached exact-input no-op path
  - previous-result-guided search still settles to the same visible text

### Performance

Track before/after counters and benchmark timings for:

- initial clamp
- repeated width shrink/grow
- repeated no-op reclamp
- slot-driven reclamp
- font-ready follow-up reclamp
- ASCII / CJK / mixed text

## Success Criteria

- unchanged text is not re-segmented on width-only reclamps
- repeated identical effective inputs skip reclamp work
- layout-only reclamps evaluate materially fewer candidates than the current full binary search path
- candidate rendering no longer pays repeated array-slice-plus-join costs
- browser behavior remains unchanged from the user’s perspective
