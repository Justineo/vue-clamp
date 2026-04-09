# 2026-04-09

- Added RichLineClamp website demo parity with the main LineClamp surface:
  - kept the shared rich HTML editor and presets
  - replaced the single rich showcase block with three demos:
    - `max-lines` + `after` slot toggle
    - `max-height` + `before` slot + external expanded control
    - `clampchange` event
  - kept the rich-specific end-only guidance in the first block
- Updated browser coverage so the rich surface is treated as a multi-example workspace:
  - verify the three rich example blocks render
  - verify preset changes flow through every rich clamp instance
  - verify the shared HTML editor drives all rich examples
