# 085 Remove Legacy And Benchmark Surface

## Goal

Remove the legacy entry and all benchmark-related code, then simplify the remaining default DOM implementation and its shared helpers until the package surface is the smallest practical version of the product.

## Steps

1. Map the remaining legacy and benchmark surface. Completed.
   - Identified package exports, website route/UI, tests, and helper modules that still assumed legacy or benchmark support.
2. Remove the legacy entry and benchmark code. Completed.
   - Deleted the `vue-clamp/legacy` export and implementation.
   - Removed benchmark code from `packages/vue-clamp` and `packages/website`.
   - Removed benchmark/legacy tests and stale demo copy.
3. Simplify the default implementation again. Completed.
   - Collapsed the runtime back into `src/component.ts` plus `src/text.ts` and public types.
   - Removed the remaining tiny single-use helper modules and trimmed a few last redundant branches.
4. Validate and update memory. Completed.
   - `vp check`
   - `vp test`
   - `vp run test:browser`
   - `vp run build -r`
