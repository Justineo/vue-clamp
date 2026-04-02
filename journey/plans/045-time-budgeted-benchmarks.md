# 045 Time Budgeted Benchmarks

## Goal

Improve the benchmark methodology by running each engine-scenario case for approximately the same amount of time and reporting the work actually completed, instead of relying on per-scenario fixed iteration counts.

## Plan

1. Replace fixed `warmupIterations` and `iterations` with shared time-budgeted warmup and measurement windows.
2. Count completed scenario operations during each timed window and derive `ms/op` from `elapsedMs / ops`.
3. Keep the current macro-run median structure and engine ordering so the report remains comparable.
4. Update benchmark UI copy and scenario facts to describe the timed methodology instead of fixed iteration counts.
5. Validate formatting/build and record the change in `journey/logs/`.

## Constraints

- Preserve scenario semantics and operation shapes.
- Keep one `op` equal to one full scenario pass across the fixture batch.
- Avoid making the full benchmark materially slower than it already is.
