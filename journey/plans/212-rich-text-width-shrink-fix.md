# Plan

## Goal

Fix the `LineClamp` rich-text width-shrink regression where stale `html` output can briefly render
with more visible lines than the configured limit.

## Steps

1. Reproduce the regression with a focused browser test that shrinks a rich-html clamp and samples
   the first visible frames after the resize.
2. Trace the current rich-text recompute path to identify exactly why stale content can reach the
   screen during shrink.
3. Change the runtime in the most correct way, prioritizing browser-correct visible output over the
   previous “brief stale content is acceptable” trade-off for this path.
4. Re-run `vp check`, `vp test`, the targeted browser suite, and the full browser suite, then
   record the design/log update in `journey/`.
