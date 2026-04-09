# 2026-04-09 Runtime performance review

- Reviewed the current runtime hot paths for `LineClamp` and `RichLineClamp`.
- There is still no dedicated rich-text benchmark in the repo; the only dedicated benchmark is
  `packages/vue-clamp/tests/wrap.browser.benchmark.ts`, so the rich-performance assessment is based
  on code-path analysis rather than direct local measurement.
- Main findings:
  - `RichLineClamp` still builds logical runs before checking whether the fully rendered HTML
    already fits, so unchanged non-clamped content pays avoidable preprocessing cost.
  - Rich binary-search probes still go through clone -> serialize -> `innerHTML` parse cycles on
    every candidate, which is now the main remaining hot-path cost.
  - Existing fast paths are good for text (`LineClamp` native one-line path) and acceptable but not
    complete for rich content (coarse run-boundary search plus coalesced recomputes).
