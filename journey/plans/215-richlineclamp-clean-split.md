# Plan

## Goal

Move multiline rich-html clamping to a dedicated public `RichLineClamp` component and return
`LineClamp` to a text-only contract, without adding a compatibility layer because the current rich
path has not been released yet.

## Steps

1. Introduce `RichLineClamp` as a first-class public component using the existing rich clamp
   engine and rich-specific render/invalidation behavior.
2. Strip `html` support out of `LineClamp`, simplify its props and runtime back to text-only
   behavior, and narrow the shared helpers accordingly.
3. Update exports and public types so `RichLineClamp` has its own props type while shared slot and
   exposed controls remain coherent.
4. Move browser coverage to the new surface:
   - keep text tests under `LineClamp`
   - move rich-html tests to `RichLineClamp`
   - update test helpers to mount either component explicitly
5. Update website demos, API reference, and package docs to present `RichLineClamp` as the rich
   entry point and remove the old `LineClamp html` framing.
6. Run the standard validation set and update `journey/design.md` plus the active log with the
   final architecture.
