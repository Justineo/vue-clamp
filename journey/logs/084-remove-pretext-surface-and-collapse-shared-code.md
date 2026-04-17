# 084 Remove Pretext Surface And Collapse Shared Code

- 2026-04-01: Started a removal pass for the Pretext path after concluding it no longer justifies its maintenance cost. The goal is not only to remove `vue-clamp/fast`, but to collapse the shared code and benchmark surface that still exists only because of that path.
- 2026-04-01: Removed the public `vue-clamp/fast` entry, deleted the Pretext dependency and the related internal modules, and rewrote the benchmark/browser helpers to stop depending on Pretext internals.
- 2026-04-01: Reduced the benchmark and website benchmark UI from three engines to default + legacy only, including the preview copy/layout and the ratio expectations in the benchmark-page browser test.
- 2026-04-01: Simplified the remaining DOM implementation shape further by removing the dead probe/font helpers, flattening the legacy component to the same simpler text-sync model as the default component, and rewriting `journey/design.md` as a clean two-entry DOM-only snapshot.
- 2026-04-01: Validation passed with `vp install`, `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`. The browser run still emits the existing non-failing mixed Vitest-version warning and `ResizeObserver loop completed with undelivered notifications` noise.
