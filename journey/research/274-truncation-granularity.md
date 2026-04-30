# Truncation granularity research

Date: 2026-04-30

## Local implementation

- `packages/vue-clamp/src/text.ts` creates a default `Intl.Segmenter` with `granularity:
"grapheme"` and stores only `boundaryOffsets`.
- `displayTextForKeptCount()` slices prefix/suffix at those offsets and inserts the ellipsis.
- `LineClamp` and `InlineClamp` both search the largest kept count that fits the live browser
  layout.

This means the implementation is Unicode-character-safe, but not word-aware.

## Standards and platform behavior

- Unicode UAX #29 defines default boundaries for grapheme clusters, words, and sentences. It also
  says locale or environment tailoring is expected for better word detection, especially for
  languages such as Thai, Lao, Chinese, and Japanese.
- ECMA-402 `Intl.Segmenter` exposes `"grapheme"`, `"word"`, and `"sentence"` granularities. Word
  results may include `isWordLike`, and what counts as word-like is implementation- and
  locale-sensitive.
- CSS `text-overflow: ellipsis` is line-end rendering, not application-controlled string
  segmentation. CSS Overflow defines its "character" as a grapheme cluster for implementation
  purposes.
- CSS `line-clamp` / `block-ellipsis` is closer to the browser line-breaking model, but it still
  cannot cover the package's custom location, inline affixes, and custom JS ellipsis behavior.
- CSS Text says normal soft wrap opportunities are usually word boundaries in many writing systems,
  but CJK and Southeast Asian scripts require different conventions and/or lexical resources.

## Library conventions

- Lodash `_.truncate()` exposes `options.separator` so callers can truncate at a separator instead
  of blindly cutting at the maximum length.
- `react-lines-ellipsis` exposes `basedOn="letters" | "words"` and defaults by guessing from the
  text.
- `react-truncate-markup` exposes tokenization by `characters` or `words`.
- `truncate-html` exposes `byWords`, but explicitly warns whitespace-based word truncation is not
  appropriate for non-alphabetic languages such as CJK.

## Recommendation

For `vue-clamp`, prefer a `boundary` / `granularity` prop over a CSS-like `word-break` prop:

- `word-break` already has a CSS meaning and would imply line-breaking behavior, not truncation
  candidate selection.
- `granularity` matches `Intl.Segmenter`, but may invite `"sentence"` immediately.
- `boundary` is clearer for this component: it chooses the allowed clamp cut points.

Use `"grapheme"` as the default and add `"word"` first. Implement fallback from word to grapheme
when no word-level candidate fits, because refusing to split a single long token would make narrow
layouts much worse.

Keep the initial public surface to string enum values only. A custom tokenizer function would widen
the support and test matrix before there is a proven need.

When `boundary` is `"word"`, native single-line `text-overflow: ellipsis` is not valid for this
component because the truncation point is chosen by the browser and cannot be constrained to the
component's word-boundary candidate set. Word mode should always use the measured JS clamp path.

## Sources

- https://www.unicode.org/reports/tr29/
- https://402.ecma-international.org/12.0/#segmenter-objects
- https://www.w3.org/TR/2021/WD-css-overflow-3-20211202/#text-overflow
- https://drafts.csswg.org/css-overflow-4/#block-ellipsis
- https://www.w3.org/TR/css-text-4/#line-breaking
- https://lodash.com/docs/#truncate
- https://www.npmjs.com/package/react-lines-ellipsis
- https://www.npmjs.com/package/react-truncate-markup
- https://www.npmjs.com/package/truncate-html
