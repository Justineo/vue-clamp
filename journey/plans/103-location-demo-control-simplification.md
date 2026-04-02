# 103 Location Demo Control Simplification

## Goal

Simplify the website `location` demo controls so the UI mirrors the API more directly.

## Changes

1. Remove the location status/readout line from the preview area.
2. Make the first control `Location` and show only enum aliases:
   - `start`
   - `middle`
   - `end`
3. Make the second control `Ratio`.
   - Keep the slider as the numeric custom input.
   - Remove the separate `Custom` button.
4. Update browser coverage to follow the new interaction shape.

## Outcome Target

- The demo presents aliases and numeric ratio as two clear inputs.
- The UI stops exposing implementation-oriented state like the effective normalized value.
