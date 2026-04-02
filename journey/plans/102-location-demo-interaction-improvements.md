# 102 Location Demo Interaction Improvements

## Goal

Make the website `location` demo easier to use without expanding the API surface or changing the page structure.

## Changes

1. Treat preset locations and numeric ratios as one control group.
   - Keep quick preset actions for `start`, `middle`, and `end`.
   - Make moving the ratio slider automatically switch to a custom numeric mode.
2. Reduce control friction.
   - Disable the ratio slider visually and semantically when a preset is active.
   - Add a few ratio quick picks so users can jump to common custom positions.
3. Keep the demo explainable.
   - Preserve the effective `location` readout.
   - Label preset and custom states clearly.
4. Update browser coverage.
   - Test that preset mode disables the custom slider.
   - Test that moving the slider switches the demo into custom ratio mode.

## Outcome Target

- The location demo works as a single interactive control rather than separate radio and slider steps.
- Users can discover custom ratios by dragging directly, while still having one-click access to the keyword aliases.
