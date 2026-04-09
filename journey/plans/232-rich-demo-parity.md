# RichLineClamp demo parity

## Goal

Mirror the main `LineClamp` website demos in the `RichLineClamp` surface, except for the
`location` example that is intentionally text-only.

## Scope

- Keep the shared rich HTML textarea and preset controls.
- Replace the single rich demo block with three rich examples:
  - `max-lines` + `after` slot toggle
  - `max-height` + `before` slot + external expanded control
  - `clampchange` event
- Preserve rich-specific guidance about trusted inline HTML and end-only truncation.
- Update browser tests so the rich surface is covered as a multi-example workspace rather than a
  single showcase block.

## Notes

- `RichLineClamp` has no `location`, so parity stops at the three generic multiline behaviors.
- Keep the implementation straightforward: separate reactive state per demo, shared HTML input and
  presets, no extra abstraction layer for the duplicated demo markup.
