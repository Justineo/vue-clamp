# Three-way Algorithm Analysis

## Goal

Produce a systematic comparison of the three clamp strategies now present in the repo:

- the legacy DOM-search algorithm
- the optimized legacy-derived DOM algorithm
- the current Pretext-based algorithm

The analysis must explain both the benchmark results and the methodological limits of the benchmark itself.

## Scope

- Inspect the benchmark implementations and the browser harness side by side.
- Compare the algorithms in terms of layout model, DOM work, search strategy, caching, and output semantics.
- Assess whether the current benchmark objectively captures the main performance differences.
- Explain why the Pretext path currently trails the DOM-based paths.
- Explain why the optimized DOM path currently wins.

## Non-Goals

- Changing the production package implementation.
- Adding new benchmark scenarios unless the analysis proves the current harness is materially misleading.
- Treating benchmark results as proof of cross-browser or cross-font universality.

## Action Plan

1. Inspect the three engines and the benchmark harness.
2. Write a structured analysis with strengths, weaknesses, and benchmark caveats.
3. Record the findings in `journey/logs/009-three-way-algorithm-analysis.md`.
