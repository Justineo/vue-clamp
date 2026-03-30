# Benchmark Report Rebuild

## Goal

Replace the current benchmark dashboard with a benchmark-specific report page that presents performance data with the right visual hierarchy, statistical context, and visual encodings.

The rebuilt page should look and read like a performance report, not a product dashboard.

## Research Direction

The rebuild should align with the benchmark-reporting patterns used by mature tooling and statistical guidance:

- `benchstat` moved toward median plus confidence interval rather than naive averages.
- Criterion.rs treats distribution, confidence intervals, and noise diagnostics as first-class benchmark outputs.
- Relative comparisons should be shown against an explicit baseline, with uncertainty shown visually rather than hidden behind narrative summaries.
- Generic dashboard cards and decorative chrome are the wrong primary language for benchmark evidence.

## Problems To Fix

1. The current page leads with narrative cards instead of the measurements.
2. It hides statistical uncertainty and sample distribution.
3. It overuses derived suite-level summaries as the primary story.
4. It uses benchmark-irrelevant visual language: soft gradients, hero sections, and card-heavy framing.
5. The current benchmark sampling depth is too shallow for meaningful interval estimates.

## Target Output

1. A compact benchmark report header.
   - title
   - run control
   - concise methodology note
2. A summary table.
   - explicit baseline engine
   - scenario wins
   - geometric-mean speedup versus baseline
   - compact notes only
3. Scenario sections grouped by workload family.
   - each scenario shows a relative comparison plot against the baseline
   - each scenario also shows exact median timing and interval values in a compact table
   - parity or behavior-difference markers remain visible but secondary
4. Supporting details.
   - environment metadata
   - raw JSON in a collapsed panel

## Engineering Plan

1. Strengthen the benchmark report data.
   - increase effective macro-run sample count to support interval estimation
   - add explicit benchmark methodology metadata to the report
   - keep existing benchmark semantics otherwise unchanged

2. Add statistics helpers for the report layer.
   - median and quantiles
   - deterministic bootstrap confidence intervals for medians
   - deterministic bootstrap confidence intervals for relative speedup vs baseline
   - compact noise and spread helpers if useful

3. Rebuild the benchmark page around report-first primitives.
   - remove hero cards and generic dashboard framing
   - add a compact summary table
   - add per-scenario forest-plot style visualizations or equivalent interval plots
   - add exact numeric tables beside or below the plot

4. Replace the benchmark styles with an austere report aesthetic.
   - minimal color
   - monospace numerics
   - gridlines and table structure instead of decorative surfaces
   - responsive layout that preserves readability on narrow widths

5. Validate and verify.
   - `vp check`
   - `vp test`
   - `vp run build -r`
   - live browser screenshots for desktop and narrow width

## Progress

- [x] Add explicit benchmark methodology metadata and deeper effective macro-run sampling.
- [x] Add reusable statistics helpers for median and baseline-relative bootstrap intervals.
- [x] Replace the dashboard page with a benchmark-report page built around interval plots and exact tables.
- [x] Replace the benchmark styling with a plain report aesthetic.
- [x] Validate with `vp check`, `vp test`, and `vp run build -r`.
- [x] Verify the live page with headless Chromium screenshots at desktop and narrow widths.

## Non-Goals

- No charting dependency.
- No benchmark-engine algorithm changes in this pass.
- No hiding of uncertainty behind summary-only claims.
