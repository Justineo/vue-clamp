# Responsive Benchmark Previews

## Goal

Keep expanded benchmark previews aligned with the current rendered width by rerunning the preview engines when preview containers resize.

## Steps

1. Add coalesced resize-driven rerendering to `BenchmarkScenarioPreview.vue`.
2. Observe preview hosts and clean up observers on unmount.
3. Update the design snapshot and validate with `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
