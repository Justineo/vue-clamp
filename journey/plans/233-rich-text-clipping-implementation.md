# Boundary-oriented rich text clipping implementation

## Goal

- Replace the current mixed-unit rich clamp search with the boundary-oriented two-level search from
  `journey/research/233-rich-text-clipping.md`.

## Planned changes

1. Rework `packages/vue-clamp/src/rich.ts` around:
   - legal cut positions expressed as tree boundary points
   - logical runs (`text` and `atomic`)
   - coarse search over run ends
   - fine search over grapheme-safe cuts inside only the next text run
   - candidate generation by slicing the original tree prefix and inserting ellipsis
2. Use rendered layout classification to distinguish transparent wrappers from atomic inline nodes
   such as inline-block and similar inline formatting contexts.
3. Keep the existing runtime fallback for layout that exits inline flow, but preserve the
   `maxHeight` unclipped fallback behavior already added in `RichLineClamp`.
4. Add/adjust browser tests for:
   - the existing fallback case
   - atomic inline layout behavior
   - unchanged rich clamp contract coverage
5. Run focused browser tests plus `vp check`.
