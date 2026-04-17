# InlineClamp in-place search log

2026-04-17

- Added a shared kept-count binary search helper in `text.ts` and reused it from multiline text clamping.
- Refactored `InlineClamp` to remove the hidden probe span. It now writes candidate bodies into the visible body segment and measures the live inline content wrapper.
- Kept the accessibility fallback that exposes the full original string when the visual body is rewritten.
- Validated with focused inline/demo browser tests, full browser tests, unit tests, and `vp check`.
