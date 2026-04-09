# Simplicity implementation

## Goals

- Remove stale internal contract surface from the rich clamp helper.
- Simplify naming and leftover implementation details across the runtime files.
- Improve clarity without introducing a larger shared shell abstraction for the multiline
  components.

## Plan

1. Prune dead rich helper types/branches/exports that no longer match the runtime model.
2. Simplify naming and internal helper structure across `LineClamp`, `RichLineClamp`, `WrapClamp`,
   `InlineClamp`, `text.ts`, `rich.ts`, `layout.ts`, and related shared files where useful.
3. Keep the multiline components separate for now and document that the shared-shell extraction was
   intentionally skipped because it would introduce a larger coordination contract.
4. Re-run `vp check`, relevant tests, and update journey notes with the simplification outcome.
