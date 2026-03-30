# Benchmark Minimal Density Pass

## Goal

Reduce the benchmark page to the minimum useful artifact:

- much smaller benchmark-specific typography
- no decorative or secondary sections
- one compact engine summary
- one dense scenario comparison matrix

## Scope

Only touch the benchmark view and project memory:

- `apps/website/src/BenchmarkPage.vue`
- `apps/website/src/style.css`
- `journey/design.md`
- `journey/logs/014-benchmark-minimal-density-pass.md`

## Actionable Steps

1. Remove non-essential benchmark UI.
   - Drop scenario descriptions.
   - Drop scenario tags.
   - Drop parity column.
   - Drop environment details.
   - Drop raw JSON details.
   - Collapse methodology into one terse inline note.

2. Reduce visual scale aggressively.
   - Lower benchmark title size.
   - Lower table font sizes.
   - Tighten row padding and section spacing.
   - Reduce chart height and label footprint.

3. Keep only high-value metrics.
   - Summary table: engine, wins, geomean vs baseline, median scenario.
   - Scenario matrix: scenario, grouped bars, three medians, two Pretext-relative speedups.

4. Keep implementation simple.
   - Remove view-model code that only served deleted sections.
   - Prefer short labels over repeated explanatory text.

5. Validate and document.
   - Run `vp check`.
   - Run `vp test`.
   - Run `vp run build -r`.
   - Verify the live benchmark page.
   - Update `journey/design.md` and the matching log.
