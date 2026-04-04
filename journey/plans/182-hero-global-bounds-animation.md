# Plan

## Goal

Use measured global min/max bounds for the hero tagline animation so the motion remains visible even
when one word (such as `line`) is close to the collapsed width.

## Steps

1. Replace per-word expanded widths in the visible animation with one measured max width derived from
   all three tagline variants.
2. Lengthen the dwell time at both the max and min states.
3. Make the mobile regression wait for a real width change instead of assuming one fixed timestamp.
4. Revalidate the focused browser suite and record the result.
