# Truncation granularity

Date: 2026-04-30

## Goal

Evaluate whether text clamping should support coarser truncation boundaries such as words, so
English prose does not end with partial words while preserving the current Unicode-safe character
behavior.

## Current state

- `LineClamp` prepares plain text with `prepareText(props.text)` and searches over the resulting
  boundary offsets.
- `InlineClamp` applies the same `prepareText()` + `searchClampedTextToFit()` flow to its
  shrinkable `body` segment.
- `prepareText()` currently exposes grapheme boundaries only. The ASCII fast path maps each code
  unit to a boundary, which is visually equivalent to character-level truncation for plain English.
- This already avoids splitting emoji and combining-character clusters, but it still allows
  truncating inside words such as `progress…` from `progressive`.

## Findings

- CSS native ellipsis is not an API for choosing truncation granularity. `text-overflow: ellipsis`
  hides grapheme clusters as needed at the line edge; `line-clamp` places the block ellipsis after
  displacing content up to a soft wrap opportunity, but browser support and customization are still
  not enough for this package's existing middle/start/custom-ellipsis behavior.
- Unicode and ECMA-402 already define the right vocabulary for JS-side segmentation:
  `grapheme`, `word`, and `sentence`.
- Existing truncation libraries commonly expose either a separator/tokenizer or an explicit
  letters-vs-words mode. This is a real convention, not an unusual product-specific option.

## Recommended API shape

Add a narrow prop on text-only surfaces:

```ts
type ClampBoundary = "grapheme" | "word";
```

- Default to `"grapheme"` for backwards compatibility and maximum fit.
- Support `"word"` for prose readability.
- Keep the prop as a string enum only for now. Do not add a callback/tokenizer form unless a
  concrete product need appears later.
- Consider `"sentence"` later only if a product need appears; it is usually too coarse for layout
  clamping and can collapse to only ellipsis in narrow containers.

## Algorithm sketch

- Generalize `PreparedText.boundaryOffsets` from grapheme offsets to clamp candidate offsets.
- Keep grapheme segmentation as the base safety layer.
- For `"word"`, build candidate offsets from `Intl.Segmenter(undefined, { granularity: "word" })`
  while including adjacent punctuation/space with the retained side so output trims cleanly.
- For start/middle truncation, derive prefix and suffix independently from the same ordered boundary
  space. Middle word truncation should avoid half words on both sides.
- If no word boundary can fit, fall back to the current grapheme boundary search so very long tokens,
  URLs, hashes, filenames, and CJK strings still produce the tightest possible result instead of
  only an ellipsis.

## Test plan for implementation

- Unit tests for ASCII prose, emoji prose, CJK/Thai-style no-space text, punctuation, leading/trailing
  whitespace, and long unbreakable tokens.
- Browser tests for `LineClamp` and `InlineClamp` in end, start, and middle locations.
- Preserve native one-line fast path only when `boundary === "grapheme"`. Word-aware truncation
  cannot use native `text-overflow` because the browser does not expose word-boundary truncation
  control for the rendered ellipsis; `boundary === "word"` must force the DOM-measured JS path even
  for single-line end truncation.

## Implementation status

- Implemented shared string-enum `boundary` support for `LineClamp`, `RichLineClamp`, and
  `InlineClamp`.
- Kept the implementation limited to `"grapheme"` and `"word"`.
- Added docs, demo controls, and focused node/browser tests.
