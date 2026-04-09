# 2026-04-08

- User asked for a detailed refactor plan from the current mixed rich-text `LineClamp`
  implementation toward a cleaner long-term architecture.
- The plan keeps the current public `LineClamp` shell and main recompute workflow as the starting
  point instead of immediately introducing a separate public `RichLineClamp`.
- Current refactor direction:
  - keep visible-DOM measurement as the default path for now
  - split text and rich clamping into distinct internal engines
  - simplify `LineClamp.ts` into a thin shared shell
  - defer any public surface split until after the internals are clean enough to judge
- Key clarification from the discussion:
  - a hidden probe can isolate binary-search mutations from the visible subtree
  - it does not solve stale committed overflow after width shrink by itself
  - that timing issue belongs to scheduling and overflow guarantees, not probe topology
- Implemented the first refactor slice:
  - extracted shared multiline helpers into `packages/vue-clamp/src/lineClampShared.ts`
  - extracted the text clamp engine into `packages/vue-clamp/src/lineClampText.ts`
  - extracted the rich clamp engine into `packages/vue-clamp/src/lineClampRich.ts`
  - reduced `packages/vue-clamp/src/LineClamp.ts` to the shared shell plus mode dispatch
  - simplified the render tail to remove the nested text/html ternary block
- Expanded browser lock coverage with a second rich width-shrink test for the external async
  container-resize path, separate from the same-flush reactive width-shrink regression.
- Validation passed with:
  - `vp check`
  - `vp test`
  - `CI=1 vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts`
  - `CI=1 vp run test:browser`
- The known browser-runner noise is unchanged:
  - `ResizeObserver loop completed with undelivered notifications.`
  - Shiki singleton warnings from the demo-page suite
