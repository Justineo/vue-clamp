# Internal API simplification log

## 2026-05-03

- Started a focused pass on recently added internal contracts after reviewing `text.ts`,
  `LineClamp.ts`, `rich.ts`, and `RichLineClamp.ts`.
- Moved native CSS eligibility and overflow probing out of `text.ts`; native single-line/multiline
  selection now stays local to `LineClamp`.
- Shortened rich internals to `prepareRich`, `patchRich`, `clampRich`, `PreparedRich`, and
  `RichState`; `patchRich` now takes `{ from, to, target }` and `clampRich` takes a named probe
  object instead of positional DOM elements.
- Changed `clampTextToLayout` to take named DOM inputs (`root`, `content`, `target`) plus clamp
  metadata, so callers no longer depend on a long positional contract.
- Removed rich fallback reason diagnostics. Unsupported rich layout still falls back to original
  HTML, but the internal contract is back to a simple boolean fallback state.
- Validation passed: `vp check --fix`, `vp test`, `vp run test:browser`, and `vp run build`.
  Browser tests still print the existing ResizeObserver loop warning, but all 82 browser tests pass.
