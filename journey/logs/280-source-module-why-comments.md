# Source module why comments log

Date: 2026-05-01

## Progress

- Started source-comment pass for `packages/vue-clamp/src`.
- Constraint: keep comments focused on architectural and branch rationale, not mechanical code
  narration.
- Added comments across all source modules:
  - public barrel/types/props/slot helpers
  - shared layout/search/text/multiline helpers
  - `LineClamp`, `InlineClamp`, `RichLineClamp`, and `WrapClamp`
  - rich structural parsing, patching, and search branches

## Validation

- `vp check`
- `vp test packages/vue-clamp/tests/text.test.ts`
