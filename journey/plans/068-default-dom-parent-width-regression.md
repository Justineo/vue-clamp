# Default DOM Parent-Width Regression

## Goal

Fix the default DOM engine so it still clamps correctly when the live width is imposed by the parent container rather than an explicit width on the clamp root itself.

## Steps

1. Reproduce the regression against the default engine path.
2. Fix the measurement clone so it preserves the live used width.
3. Add a browser regression where the parent container owns the width.
4. Run `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
