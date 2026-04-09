# Leftover cleanup

## Goals

- Review the recent simplification changes for stale names, dead branches, and unnecessary helper
  surface.
- Remove only real leftovers from the touched runtime files without broadening the refactor again.
- Revalidate the simplified runtime and record any remaining limits clearly.

## Plan

1. Inspect the recently changed runtime files and tests for leftover logic, naming, or duplicated
   patterns that no longer pull their weight.
2. Apply a narrow cleanup pass to remove those leftovers while preserving the current rich-layout
   correctness boundaries.
3. Re-run checks and the most relevant tests, then update journey notes with the resulting state.
