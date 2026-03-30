# Wrapper Simplification Review

## Goal

Remove small wrapper helpers and verbose object-copy patterns that add noise without improving clarity or behavior.

## Scope

- `packages/vue-clamp/src/clamp.ts`
- `apps/website/src/benchmark/runBenchmarks.ts`
- `apps/website/src/BenchmarkPage.vue`
- `journey/logs/023-wrapper-simplification-review.md`

## Focus

- Inline or delete trivial object-copy helpers.
- Replace repetitive branchy selector helpers with direct constants where that reads better.
- Keep the changes local and high-confidence.
- Do not widen the public API or change behavior.

## Plan

1. Review the current code for wrapper-style helpers and copy-heavy call sites.
2. Remove the ones that are clearly redundant.
3. Keep the remaining helpers only when they materially improve readability.
4. Validate with `vp fmt`, `vp check`, and `vp test`.

## Acceptance Criteria

- The obvious object-copy helper patterns are gone.
- Benchmark and clamp code read more directly.
- No behavior changes are introduced.
