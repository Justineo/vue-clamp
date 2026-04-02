# 042 Benchmark Runner Width Regression

## Goal

Investigate why the benchmark appeared to run indefinitely after the simplification refactor and restore the intended benchmark behavior without changing benchmark semantics.

## Plan

1. Inspect the benchmark page, runner, preview, and shared support code for loops or runner/preview coupling mistakes.
2. Reproduce the benchmark timing against a local built preview.
3. Fix any regression in shared benchmark fixture construction.
4. Rebuild and verify that the benchmark promise resolves in a reasonable finite time.
