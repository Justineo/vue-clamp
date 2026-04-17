# 2026-03-30 Three-way Algorithm Analysis

## Summary

- Compared the legacy DOM-search engine, the optimized legacy-derived DOM engine, and the current Pretext-based engine at the algorithm and benchmark-methodology levels.
- The benchmark is good enough to establish a strong direction for the current implementations, but not strong enough to claim universal cross-browser or cross-product truth.
- The current Pretext path underperforms mainly because it uses Pretext as a repeated candidate-string evaluator instead of as a prepared-text engine with persistent handles.

## Systematic Comparison

### Legacy DOM-search

- Source baseline: `master:src/components/Clamp.js`
- Benchmark implementation: `packages/vue-clamp/src/benchmark/legacy-dom.ts`
- Core strategy:
  - write a candidate string into the live DOM
  - ask the browser whether it overflowed via `getClientRects()` and `scrollHeight`
  - recurse toward the boundary with a binary-style search
  - finish with `fill()` and `clamp()` one character at a time
- Main strengths:
  - simple mental model
  - relies on the browser's actual line breaking and slot layout
  - no explicit font extraction, segmentation, or layout simulation
- Main costs:
  - repeated DOM writes
  - repeated line counting and overflow reads
  - duplicated work near the fit boundary because the recursive search, `fill()`, and `clamp()` can revisit nearby offsets

### Optimized Legacy-derived DOM

- Source: `packages/vue-clamp/src/benchmark/optimized-legacy-dom.ts`
- Core strategy:
  - keep the same DOM oracle and the same output semantics as the legacy algorithm
  - switch to a direct monotonic binary search over "does this offset fit?"
  - memoize fit decisions per offset within one run
  - avoid redundant `textContent` writes when the candidate string is unchanged
- Main strengths:
  - keeps the browser's native line breaker as the truth source
  - removes most of the search-policy waste from the legacy version
  - preserves apples-to-apples text output for comparison
- Main costs:
  - still pays for synchronous DOM layout reads
  - still depends on the browser for every candidate evaluation

### Current Pretext-based engine

- Benchmark entry: `packages/vue-clamp/src/benchmark/pretext-dom.ts`
- Core computation: `packages/vue-clamp/src/clamp.ts`
- Core strategy:
  - read DOM inputs once per clamp run: width, font, line height, slot widths, max height
  - compute full-text line count in JS
  - if clamp is needed, segment the whole string into graphemes
  - binary-search the kept grapheme count
  - for each candidate string, prepare it with Pretext and walk its lines from the start
- Main strengths:
  - no dependency on browser line-count reads for the text body
  - grapheme-aware correctness
  - explicit slot-width modeling and deterministic JS layout behavior
- Main costs:
  - more CPU work in userland per clamp
  - more string allocation during candidate generation
  - repeated text preparation for every candidate
  - repeated full line walks for every candidate

## Benchmark Adequacy

### What the current benchmark does well

- All three engines run against live browser DOM fixtures with the same width, font, line height, slot content, and text inputs.
- The harness waits for fonts, warms up each scenario, rotates engine order across scenarios, and covers both single-instance and batch workloads.
- The scenario set exercises the main behavior dimensions that matter to this library:
  - no-op fit
  - end/start/middle clamp
  - atomic `before` and `after` content
  - `maxLines`
  - `maxHeight`
  - resize-driven reclamp
  - text-update-driven reclamp
- The observed gaps are not tiny. The optimized DOM engine wins by wide enough margins, especially on batch text updates, that the result is unlikely to be pure measurement noise.

### What the current benchmark does not prove

- It does not measure full Vue component cost. It isolates clamp-engine work inside a plain DOM harness.
- It does not establish cross-browser truth. The recorded run is Chrome 146 on macOS with one font setup.
- It does not yet provide strong statistical rigor:
  - one recorded three-way run
  - no median/p95 over multiple macro-runs
  - no CPU throttling or isolated background-process control
- It does not measure memory, GC pressure, or long-session cache behavior.
- It does not measure a hypothetical "best possible Pretext design"; it measures the Pretext design we actually implemented.

### Bottom-line judgment on adequacy

- The benchmark is adequate for the question "which current implementation is faster in our present codebase under realistic browser clamp workloads?"
- The benchmark is not adequate for the stronger question "which paradigm is inherently faster in all circumstances?"

## Why the current Pretext path loses

### 1. It defeats Pretext's intended amortization model

- Pretext's low-level model is strongest when text is prepared once and then laid out many times at different widths.
- The installed Pretext package's own demos explicitly keep prepared handles in userland caches keyed by `font + text`.
- Our current clamp path does not keep a prepared handle for the full text or for candidate states.
- Instead, `countRenderedLines()` calls `prepareWithSegments()` every time it evaluates a candidate string.

Effect:

- We are repeatedly paying analysis, segment lookup, and prepared-structure allocation costs inside the clamp search itself.
- That turns Pretext from an amortized layout engine into a repeated candidate-preparation engine.

### 2. We are solving the wrong search problem with expensive candidate materialization

- The DOM engines ask a narrow question: "does this rendered string fit?"
- The current Pretext engine asks a more expensive question:
  - build a candidate string
  - prepare it
  - lay out all its lines from the start
  - compare its line count to the limit
- This repeats for every binary-search midpoint and once again for the final result.

### 2a. We are also using a richer Pretext API than this hot path needs

- `countRenderedLines()` uses `layoutNextLine()`.
- `layoutNextLine()` materializes a `LayoutLine`, including the line text.
- Our clamp code only needs widths, cursors, and line counts; it does not consume the line text.
- Pretext exposes lower-level range-oriented APIs such as `walkLineRanges()` that avoid this materialization cost.

Effect:

- Even after paying to prepare a candidate, our current line walk is still doing more work than necessary.

Effect:

- Each search step is heavy.
- The algorithm does more total work than the DOM versions even before considering DOM read costs.

### 3. It adds correctness work that the DOM versions do not pay for

- The current Pretext path is grapheme-aware.
- The DOM paths operate on code-unit slices and let the browser's actual rendered result be the final oracle.

Effect:

- The Pretext path pays extra segmentation and candidate-building cost for better text correctness.
- That cost is real, and the benchmark is correctly capturing it.

### 4. It still requires some DOM input reads anyway

- Even the Pretext path still reads:
  - container width
  - computed font
  - line height
  - slot widths
  - resolved CSS max height
- So the Pretext path does not eliminate DOM interaction entirely for this component shape.

Effect:

- It pays both worlds' costs:
  - DOM input measurement
  - JS text-layout computation

### 5. Our specific component problem is simpler than Pretext's strongest use cases

- Pretext shines most when many layouts reuse the same prepared text, or when layout geometry is too complex for the DOM to answer cheaply.
- Our clamp problem is narrower:
  - one inline box
  - one width
  - a fit boundary search
  - comparatively short paragraphs
- The browser already has an extremely optimized inline-layout engine for exactly this problem.

Effect:

- The DOM oracle is unusually competitive here.
- Pretext's generality is not translating into a win for this task in the current design.

## Why the optimized DOM version wins

### 1. It keeps the browser's line breaker as the oracle

- The browser already knows the exact answer to "how many lines did this inline content take?"
- The optimized DOM engine asks the browser directly instead of rebuilding that reasoning in JS.

### 2. It removes the legacy search waste without changing semantics

- The old recursive search plus `fill()` and `clamp()` revisits nearby offsets.
- The optimized version turns the problem into a clean monotonic fit search with a single final refinement step.

Effect:

- Fewer candidate evaluations.
- Less duplicated layout work.

### 3. It suppresses redundant DOM invalidation

- The optimized version only writes `textContent` when the candidate actually changes.
- The fit cache means repeated offsets do not trigger another mutation or measurement.

Effect:

- Less DOM churn.
- Fewer needless restyle/layout invalidations.

### 4. It fails fast on the cheapest rejection path

- Height overflow is checked before line counting.
- Only candidates that survive the height check pay the line-count cost.

Effect:

- Cheaper rejection on some `maxHeight` cases.

### 5. Its semantics are cheaper

- It preserves the legacy code-unit slice behavior instead of doing grapheme-safe truncation.
- It does not need font parsing, line-height resolution, or slot-width simulation logic in the clamp loop.

Effect:

- Lower CPU and allocation overhead per candidate.

## Conclusions

- The benchmark is directionally strong for the current codebase: the optimized legacy-derived DOM engine is the best current implementation of these three.
- The result does not prove that Pretext is a bad fit in principle. It proves that our current Pretext adaptation is not aligned with Pretext's own performance model.
- If we want a fairer "Pretext done right" comparison, the next experiment should cache full prepared handles per `font + text` and search using prepared-text state rather than re-preparing every candidate string.
- The integration should also stop using `layoutNextLine()` for pure line counting and range walking, because that hot path does not need line-text materialization.
