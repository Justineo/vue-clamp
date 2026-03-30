# Benchmark Report Minimal Spectre Pass

## Goal

Reduce the benchmark page to a smaller, denser Spectre-aligned report that emphasizes relative performance versus Legacy DOM instead of absolute throughput.

## Scope

- `apps/website/src/BenchmarkPage.vue`
- `apps/website/src/style.css`
- `apps/website/src/benchmark/runBenchmarks.ts`
- `journey/design.md`
- `journey/logs/018-benchmark-report-minimal-spectre-pass.md`

## Requirements

- Use a visual style that fits the existing Spectre-based website instead of a custom dashboard/report skin.
- Reduce font sizes and spacing further.
- Keep the page high-density and minimal.
- Show relative performance ratios against `legacy-dom` as the main metric.
- Treat Legacy DOM as the `1.00x` baseline.
- Move raw throughput details to tooltips instead of table cells.
- Preserve the current three-engine comparison scope:
  - `pretext`
  - `optimized-dom`
  - `legacy-dom`

## Plan

1. Simplify the report structure.
   - Keep only a small header with actions.
   - Keep one compact summary table.
   - Keep one dense scenario table.
   - Remove any remaining explanatory or decorative copy that is not necessary.

2. Shift the primary metric to baseline-relative ratios.
   - Summary table:
     - engine
     - wins
     - geometric mean vs Legacy DOM
   - Scenario table:
     - scenario label
     - Pretext vs Legacy
     - Optimized DOM vs Legacy
     - Legacy DOM fixed at `1.00x`
   - Put absolute `ops/s` in `title` tooltips for cells and bars.

3. Simplify the visual language.
   - Reuse Spectre table/button conventions where possible.
   - Remove the custom benchmark “report” framing.
   - Use smaller font sizes, tighter row height, and less padding.
   - Keep color only where it materially improves scan speed.

4. Keep the data model lean.
   - Avoid adding new report fields unless the page truly needs them.
   - Compute display-only ratios in the page when that keeps the benchmark report shape smaller and clearer.

5. Validate.
   - Run formatting on touched files.
   - Run `vp check`.
   - Run `vp test` if the changes touch behavior beyond presentation.
   - Run `vp run build -r`.
   - Do a browser sanity check on `/?view=benchmark`.

## Acceptance Criteria

- The page looks like a natural part of the existing Spectre demo site.
- The page is visibly smaller and denser than the current version.
- The main visible numbers are speedup ratios versus Legacy DOM.
- Raw throughput is still available on hover.
- No benchmark logic or scope is accidentally expanded.
