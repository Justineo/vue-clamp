# 101 Demo Location Feature Update

## Goal

Update the website demo and API reference to reflect the new `location` support:

- keyword aliases: `start`, `middle`, `end`
- numeric ratios from `0` to `1`

## Steps

1. Update the location demo controls.
   - Keep the existing keyword presets.
   - Add a ratio mode with a live slider and numeric display.
   - Show the effective `location` value being passed to `<Clamp>`.
2. Update website copy and API docs.
   - Refresh the features list language.
   - Update the props table type and description for `location`.
3. Add or adjust browser coverage if needed.
4. Validate with `vp check`, `vp test`, and `vp run test:browser`.

## Outcome Target

- The demo makes the ratio feature discoverable without changing the page structure.
- The API table clearly explains keywords as aliases for numeric positions.
