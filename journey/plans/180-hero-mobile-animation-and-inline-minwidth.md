# Plan

## Goal

Tighten the hero tagline width and make the animation visible on mobile, while ensuring
`InlineClamp` never shrinks the body past a usable ellipsis width.

## Steps

1. Inspect the current hero width logic and `InlineClamp` body sizing to confirm why mobile still
   appears static.
2. Adjust `InlineClamp` so the body keeps at least an ellipsis-sized minimum width.
3. Rework the hero tagline width model so the expanded state is narrower and the collapsed state
   still differs visibly on mobile.
4. Validate with focused browser tests and record the change in journey memory.
