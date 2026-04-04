# InlineClamp Tagline Hero

Date: 2026-04-04

## Goal

Turn the hero tagline itself into a seamless `InlineClamp` demo by animating width changes around the words `line`, `inline`, and `wrap`.

## Plan

1. Remove the separate hero proof strip.
2. Build one animated `InlineClamp` tagline with fixed prefix/suffix and a rotating keyword body.
3. Collapse the keyword via width changes, switch it while hidden, then expand again.
4. Pause on hover or focus and respect `prefers-reduced-motion`.
5. Keep badges and links secondary to the animated tagline.
6. Format and rerun the demo browser test.
