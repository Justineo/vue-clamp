# Rich benchmark A/B

## Goals

- Measure `RichLineClamp`-specific runtime cost before and after the latest performance pass.
- Keep the benchmark browser-based and aligned with the existing benchmark style.
- Compare representative scenarios for both unchanged-fit and truncating rich content.

## Plan

1. Reconstruct the pre-optimization rich clamp helper as a benchmark-only test helper.
2. Add a browser benchmark that runs the current and legacy helpers through the same DOM scenarios.
3. Track high-signal metrics:
   - total time
   - mean step time
   - `getBoundingClientRect` reads
   - `getClientRects` reads
   - DOM rewrite calls
4. Run the benchmark and summarize the deltas.
