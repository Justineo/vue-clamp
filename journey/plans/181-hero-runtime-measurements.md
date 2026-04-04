# Plan

## Goal

Replace the hero tagline's guessed widths with runtime measurements taken after the webfont is
ready, so the animation uses real expanded and collapsed widths on every viewport.

## Steps

1. Add hidden `InlineClamp` measurement probes for each animated word and the collapsed state.
2. Wait for `document.fonts.ready`, measure the probes, and only then start the tagline loop.
3. Recompute those measurements when the hero shell width changes so responsive font sizing stays
   in sync.
4. Revalidate the inline and demo-page browser tests and record the result.
