# 263 Rich structural second simplification pass

## 2026-04-16

- Kept full rich decisions as direct `{ kind: "full" }` values instead of introducing a shared exported constant.
- Used the exported `PreparedRichText` type directly in `RichLineClamp`.
- Collapsed the persistent probe content/body/rich elements into one `ProbeElements` object and removed repeated probe body reattachment.
- Removed a duplicate single-text-run branch in `buildLogicalRuns` and cached a repeated inline-display check while preserving the same rich support rules.
- Kept `LineClamp`'s `resetClamp` wrapper because it names a repeated semantic reset branch clearly.
- Made `sizeSignature`, `BoundaryPoint`, and `RichClampResult` file-local because they are not imported across module boundaries.
- Validation passed:
  - `vp check`
  - `vp test`
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `vp run benchmark:rich`
  - `vp run build` from `packages/vue-clamp`
