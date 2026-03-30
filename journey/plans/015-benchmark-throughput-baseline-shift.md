# Benchmark Throughput Baseline Shift

## Goal

Make the benchmark page read as a throughput comparison rather than a timing sheet.

## Changes

1. Switch the benchmark page from median iteration time to derived throughput.
   - Show `ops/s`.
   - Make the bar chart longer-is-faster.

2. Make Legacy DOM the main reference baseline.
   - Summary speedups should be shown relative to Legacy DOM.
   - The scenario matrix should highlight how much faster Pretext is than Legacy DOM.

3. Keep the page minimal.
   - Do not add new sections.
   - Prefer replacing existing columns over adding more UI.

## Validation

- Run `vp check`.
- Run `vp test`.
- Run `vp run build -r`.
- Verify the live benchmark page after autorun.
