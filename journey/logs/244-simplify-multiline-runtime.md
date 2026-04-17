# 2026-04-10 Simplify multiline runtime

- Follow-up from the second simplicity review.
- Implemented:
  - extracted `packages/vue-clamp/src/multiline.ts` as the shared shell for
    `LineClamp` / `RichLineClamp`
  - moved the repeated multiline shell into that helper:
    - frame refs
    - `expanded` / `clamped` state
    - exposed `expand` / `collapse` / `toggle`
    - queued recomputes
    - `ResizeObserver` invalidation
    - font-load invalidation
    - same-flush `onUpdated` invalidation
  - kept the actual clamp algorithms local to each component instead of introducing a generic
    strategy interface
  - simplified `packages/vue-clamp/src/rich.ts`:
    - made the rendered-layout inspector explicit through `inspectRenderedRichLayout()`
    - simplified `RichClampResult` to `{ html, fallback }`
  - simplified `packages/vue-clamp/src/WrapClamp.ts`:
    - removed indirect DOM lookup helpers
    - switched content / before / after handling to direct refs
  - follow-up cleanup after extracting the shell:
    - removed duplicated `expanded` watchers that were still left in `LineClamp` and
      `RichLineClamp`
    - renamed the shared helper from `useMultilineClampController()` to `useMultilineClamp()`
- Validation:
  - `vp fmt`
  - `vp check`
  - `vp test packages/vue-clamp/tests/text.test.ts packages/vue-clamp/tests/exports.test.ts`
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- Notes:
  - `wrap.browser.test.ts` passed, with the existing non-fatal `ResizeObserver loop completed with
undelivered notifications` browser console noise
  - targeted `clamp.browser.test.ts` runs still stall locally after startup on this machine, so the
    touched `LineClamp` / `RichLineClamp` browser paths did not get a clean final run in this pass
