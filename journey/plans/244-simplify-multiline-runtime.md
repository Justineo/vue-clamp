# Simplify multiline runtime

## Goals

- Extract only the genuinely repeated multiline controller logic shared by `LineClamp` and
  `RichLineClamp`.
- Simplify the rich runtime helper contracts so their responsibilities are explicit.
- Reduce unnecessary indirection in `WrapClamp` without weakening correctness or performance.

## Plan

1. Inspect the current multiline component shells and the remaining rich / wrap helper contracts.
2. Extract a minimal shared multiline controller and simplify the local runtime helpers around it.
3. Re-run checks and the most relevant tests, then update journey notes with the new runtime shape.
