# 077 Production Legacy Component Benchmark

## Goal

Replace the benchmark-only legacy wrapper approach with a real production-level `legacy` component that sits alongside the default and fast entries, then have the benchmark mount those three actual components directly.

## Steps

1. Add `packages/vue-clamp/src/legacy.ts` with the same public Vue contract shape as the default and fast entries.
2. Add a package export/build entry for `vue-clamp/legacy`.
3. Switch benchmark support, preview, and runner code to mount the three real production components.
4. Remove the benchmark-only component wrapper layer.
5. Update tests and project memory, then run full validation.

## Outcome

- `packages/vue-clamp/src/legacy.ts` is now a real production component entry.
- `packages/vue-clamp/package.json` now publishes `vue-clamp/legacy`.
- The benchmark runner and preview mount the three production components directly.
- The benchmark-only component wrapper layer was removed.
