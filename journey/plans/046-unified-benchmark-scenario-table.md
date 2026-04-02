# Unified Benchmark Scenario Table

## Goal

Use one scenario list on the benchmark page before, during, and after a run so status and final results are rendered from the same row model. Also switch the Pretext preview card to the real Vue `Clamp` component instead of the synthetic benchmark adapter. Keep benchmark behavior and measurements unchanged.

## Constraints

- Do not change benchmark scenario definitions, engine order, timed sampling, or measurement semantics.
- Keep the existing compact benchmark page structure.
- Keep the benchmark runner and measured engines unchanged. Any preview change must stay visual-only and must not affect the timed benchmark path.

## Plan

1. Collapse the page onto one scenario-row model keyed by the canonical `listBenchmarkScenarios()` output.
2. Feed that row model with status-only data before results exist, then layer final engine ratios/bars onto the same rows after each scenario completes.
3. Replace the separate progress-only table and results-only scenario table with one unified scenario table that always renders.
4. Update the preview so the Pretext card renders the real `Clamp` component, while the DOM baseline cards keep their synthetic benchmark fixtures.
5. Keep the engine summary table separate, since it answers a different question than per-scenario progress.
6. Update journey notes if the benchmark page structure or benchmark-preview explanation needs to be reflected in shared project memory.
7. Validate with `vp check` and a production build to ensure the page still compiles cleanly.
