# 043 Benchmark Progress UI

## Goal

Make the benchmark page feel responsive during long runs without changing benchmark semantics.

## Plan

1. Add a scenario-level progress API to the benchmark runner.
2. Yield back to the browser between scenario status transitions so the page can paint.
3. Update the benchmark page to render all scenarios immediately in a compact progress list.
4. Mark each scenario as `pending`, `running`, or `done` as the run advances.
5. Keep the existing benchmark report and final summary behavior unchanged.

## Constraints

- Do not change scenario definitions, engine order, or benchmark timing methodology.
- Keep progress updates coarse at the scenario level, not per-iteration.
- Prefer minimal UI/state additions over a larger benchmark dashboard refactor.
