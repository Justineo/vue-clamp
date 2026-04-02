# 062 Dual Engine Package Surface Evaluation

## Goal

Evaluate whether `vue-clamp` should expose two public engines, keeping the DOM engine as the default package entry and offering the current Pretext implementation behind a secondary entry such as `vue-clamp/pretext`.

## Questions

1. Is the benchmark DOM engine mature enough to become a supported public implementation?
2. Does a dual-engine package simplify the production path, or does it mostly move complexity into API, packaging, testing, and docs?
3. Which default aligns better with the current project goals, benchmarks, and trade-off record?

## Output

Provide a recommendation, the key risks, and the smallest viable shape if dual-engine support is pursued.
