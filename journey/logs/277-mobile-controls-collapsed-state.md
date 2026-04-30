# Mobile controls collapsed state log

Date: 2026-04-30

## Implementation

- Replaced the thin mobile collapsed controls row with a taller disclosure row.
- The collapsed row now includes:
  - leading settings glyph in an accent tile
  - `Demo controls` title
  - current-settings summary
  - trailing chevron
- The disclosure resets to collapsed when switching component surfaces.
- Demo page browser coverage now checks the disclosure label, expanded state, and surface-switch
  reset behavior.

## Validation

- Targeted `vp check`
- Targeted demo-page browser test
- Manual Playwright verification at `390px` width:
  - collapsed row height is `58px`
  - collapsed panel height is `0`
  - expanded panel has no horizontal overflow
