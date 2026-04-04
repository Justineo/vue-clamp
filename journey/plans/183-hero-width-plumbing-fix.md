# Plan

## Goal

Let the hero tagline use the real measured widths for `line`, `inline`, and `wrap` instead of
flattening them through an extra JS clamp.

## Steps

1. Remove the JS width clamping layer from the hero tagline state.
2. Let the CSS width/max-width relationship constrain the measured target width instead.
3. Keep the runtime remeasurement on shell resize so responsive font-size changes still update the
   measured targets.
4. Revalidate the focused browser suite and record the result.
