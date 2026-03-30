# Pretext Engine Test Matrix

## Goal

Add comprehensive Pretext-engine coverage for clamp behavior, especially the single-line and multi-line width-budgeting cases that component tests in jsdom cannot prove visually.

## Current Gap

- Current coverage in `packages/vue-clamp/tests/clamp.test.ts` is mostly component-level.
- We do have light slot-related checks, but we do not have strong engine-level tests that prove:
  - `afterWidth` stays on the last visible line when it should fit
  - `afterWidth` forces an extra line when it should not fit
  - `beforeWidth` correctly consumes first-line width
  - `start` / `middle` / `end` keep-count behavior stays correct across single-line and multi-line cases
- jsdom component tests are not enough to prove real visual line placement. The highest-value missing layer is deterministic engine tests around `computeClampText()`.

## Test Strategy

1. Keep component tests for Vue contract and reactive flows.
2. Add a new dedicated engine test file for `computeClampText()` and related source/candidate behavior.
3. Prefer real Pretext preparation plus deterministic fixed-width fixture inputs over browser-layout assertions.
4. Assert engine outputs:
   - `clamped`
   - `displayText`
   - `lineCount`
   - `maxLines`
5. Where visual placement is the concern, encode it as line-budget assertions via `beforeWidth` / `afterWidth`, not DOM wrapping assertions.

## Test File Shape

- Add `packages/vue-clamp/tests/engine.test.ts`.
- Keep `packages/vue-clamp/tests/clamp.test.ts` for component behavior only.
- Add small local helpers in the engine test file:
  - `source(text, font?)`
  - `run(inputOverrides)`
  - optional fixtures for common widths/limits/ellipsis

## Scenario Matrix

### A. No-clamp baselines

1. Empty text returns unclamped with `lineCount = 0`.
2. No limit returns unclamped full text.
3. Exact fit within `maxLines` returns unclamped full text.
4. Exact fit within `maxHeight` returns unclamped full text.
5. Zero/invalid limits normalize to “no effective limit”.

### B. End truncation

1. Single-line overflow with default ellipsis.
2. Multi-line overflow with default ellipsis.
3. Exact-edge case where one more grapheme would overflow.
4. Ellipsis-only result when no source grapheme can fit.
5. Custom ellipsis string changes the displayed text and fit behavior.

### C. Start truncation

1. Single-line overflow from the start.
2. Multi-line overflow from the start.
3. Exact-edge case at the clamp threshold.
4. Ellipsis-only result when suffix content cannot fit with more text.

### D. Middle truncation

1. Single-line overflow in middle mode.
2. Multi-line overflow in middle mode.
3. Odd kept-count preserves the full requested count.
4. Even kept-count keeps the expected prefix/suffix split.
5. Ellipsis-only result when no source grapheme can fit.

### E. Grapheme safety

1. ASCII-safe text uses simple source segmentation and still clamps correctly.
2. Emoji ZWJ sequence is never split across the clamp boundary.
3. Combining-mark text is never split across the clamp boundary.
4. Regional-indicator / flag emoji is never split across the clamp boundary.

### F. `beforeWidth` budgeting

1. `beforeWidth = 0` matches the slotless baseline.
2. Consuming first-line width can turn an unclamped case into a clamped case.
3. Large `beforeWidth` can force text onto the next line while still counting correctly.
4. `beforeWidth >= containerWidth` still produces stable line counting.

### G. `afterWidth` budgeting

1. `afterWidth = 0` matches the slotless baseline.
2. `afterWidth` that still fits on the last line does not add a line.
3. `afterWidth` that does not fit on the last line adds one line.
4. Single-line case where `afterWidth` is the difference between fit and clamp.
5. Multi-line case where `afterWidth` changes the winning candidate.
6. Regression case mirroring the old “after appears on a new line” bug:
   - one assertion where the chosen candidate still fits with `afterWidth`
   - one assertion where a slightly larger candidate would force an extra line

### H. Combined `beforeWidth` + `afterWidth`

1. Both widths active in a single-line limit.
2. Both widths active in a multi-line limit.
3. Candidate chosen correctly when first-line and last-line budgets both constrain the result.

### I. `maxLines` and `maxHeight` interaction

1. `maxLines` only.
2. `maxHeight` only.
3. Both present, smaller effective limit wins.
4. String `maxHeight` should already be normalized before engine entry; component keeps that responsibility.
   Engine test coverage should stay numeric here.

### J. Source and candidate reuse behavior

1. `getSource()` reuses the same source for identical trimmed text + font.
2. `getSource()` invalidates on text change.
3. `getSource()` invalidates on font change.
4. `computeClampText()` exact-input fast path reuses the last result.
5. Changing any effective input invalidates that fast path.

## Assertion Principles

- Favor precise expected `displayText` for focused small fixtures.
- Favor line-budget assertions for width-sensitive slot cases.
- Keep each test small and named around one behavior.
- Avoid large prose-heavy fixtures unless the case truly needs them.

## Implementation Order

1. Add engine test helpers and no-clamp baselines.
2. Add end/start/middle scenario coverage.
3. Add `beforeWidth` / `afterWidth` / combined-width regression coverage.
4. Add grapheme-safety cases.
5. Add source/cache reuse cases.
6. Re-run `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.

## Out of Scope for This Batch

- Real-browser visual regression tests for actual DOM wrapping.
- Full component-level matrix duplication of the same engine cases.
- Benchmark assertions.
