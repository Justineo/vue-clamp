# 2026-04-08

- Follow-up simplification after the clean `LineClamp` / `RichLineClamp` split.
- Implemented the final runtime file layout:
  - `packages/vue-clamp/src/text.ts` now owns text preparation, text clamp search, location
    normalization, and native one-line eligibility helpers
  - `packages/vue-clamp/src/rich.ts` now owns rich preparation, rich materialization,
    rendered-layout validation, and rich clamp search
  - `packages/vue-clamp/src/layout.ts` holds only the genuinely shared measurement helpers:
    `normalizeLineLimit`, `sizeSignature`, and `fitsContent`
  - removed the transitional `lineClampShared.ts`, `lineClampText.ts`, and `lineClampRich.ts`
- Validation passed with:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
