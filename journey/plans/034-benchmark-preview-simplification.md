# Benchmark Preview Simplification

## Goal

Apply a narrow code-simplifier pass to the recently modified benchmark preview path, reducing local complexity without changing behavior.

## Steps

1. Review `BenchmarkScenarioPreview.vue`, `BenchmarkPage.vue`, and nearby benchmark helpers for redundant branches or noisy structure.
2. Apply only high-confidence local simplifications that improve readability and maintainability.
3. Validate with `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
