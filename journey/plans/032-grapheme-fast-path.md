# Grapheme Fast Path

## Goal

Skip `Intl.Segmenter` for clearly safe ASCII text while keeping full grapheme segmentation for everything else.

## Steps

1. Add a narrow ASCII-safe detector in `packages/vue-clamp/src/clamp.ts`.
2. Use simple `split("")` units for that path and keep `Intl.Segmenter` for all other text.
3. Add focused tests proving the fast path stays off `Intl.Segmenter` for ASCII and still uses it for emoji-rich text.
4. Update the design snapshot and run `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
