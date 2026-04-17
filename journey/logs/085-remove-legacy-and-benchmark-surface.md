# 085 Remove Legacy And Benchmark Surface

- 2026-04-01: Started a removal pass for the legacy entry and all benchmark-related code. The follow-up goal is to simplify the remaining default DOM implementation now that there is only one real runtime path left.
- 2026-04-01: Removed the `vue-clamp/legacy` export and implementation, deleted the internal benchmark modules and benchmark/browser tests, and collapsed the website back to the demo/docs surface without a benchmark route.
- 2026-04-01: Flattened the remaining runtime back into `packages/vue-clamp/src/component.ts`, keeping only `src/text.ts` and public types as supporting modules. Deleted the tiny single-use helper modules that only fragmented the one remaining component path.
- 2026-04-01: Added a small node-side `text.test.ts` so `vp test` remains meaningful after the benchmark/engine test removals.
- 2026-04-01: Validation passed with `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`. The browser suite still emits the existing non-failing mixed Vitest-version warning and `ResizeObserver loop completed with undelivered notifications` noise.
