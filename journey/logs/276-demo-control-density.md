# Demo control density log

Date: 2026-04-30

## Implementation

- Fixed the component tabs to a `42px` block size and reused that value as the shared-controls
  sticky offset, removing the visual gap between sticky tabs and controls.
- Normalized single-line demo control geometry around one `--control-height` so labels, pills,
  inputs, ranges, and checkboxes align consistently.
- Made `PillControls` more compact by default.
- Added a mobile disclosure button for each shared control bar. At narrow widths the panel starts
  collapsed, expands in place, and keeps panel content within the viewport width.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build`
- Manual Playwright checks at desktop width and `390px` width confirmed sticky geometry, collapsed
  panel height, expanded panel height, and no horizontal overflow across all four surfaces.
