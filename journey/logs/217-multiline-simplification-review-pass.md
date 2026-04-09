# 2026-04-08

- Starting a second deep simplification pass after the clean public split and the file-layout
  cleanup.
- Candidate simplifications for this pass:
  - remove unnecessary internal result wrapper types in `text.ts` and `rich.ts`
  - deduplicate the identical queued recompute loop across multiline components with one tiny
    helper instead of three copies
  - reuse `layout.ts` in `WrapClamp` instead of carrying local duplicates
  - reuse production helpers in browser-test utilities where it actually reduces noise
- Completed:
  - `text.ts` now returns the next rendered string directly from `clampTextToLayout`; `LineClamp`
    derives `clamped` from whether the rendered text still matches the prepared source text
  - `rich.ts` now returns `{ html, reason? }` from `clampRichTextToLayout`; `RichLineClamp`
    derives `clamped` from whether the rendered html still matches the prepared source html
  - `layout.ts` now owns a single tiny `createQueuedTask` helper, removing the duplicated
    pending/running async recompute loop from `LineClamp`, `RichLineClamp`, and `WrapClamp`
  - `WrapClamp` now imports `normalizeLineLimit` and `sizeSignature` from `layout.ts` instead of
    keeping local copies
  - `packages/vue-clamp/tests/browser.ts` now reuses `normalizeLocationRatio` from `text.ts`
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
- Browser noise remains unchanged:
  - `ResizeObserver loop completed with undelivered notifications.`
  - Shiki singleton warnings in website browser tests
