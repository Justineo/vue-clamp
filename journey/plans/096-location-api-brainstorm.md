# 096 Location API Brainstorm

## Goal

Evaluate whether `location` should grow beyond the current keyword set (`start`, `middle`, `end`) and identify the smallest extension that adds real product value without making the clamp API opaque.

## Current State

- `location` is currently a discrete strategy selector.
- The clamp algorithm still searches for one `kept` budget.
- `location` only controls how that budget is distributed between prefix and suffix:
  - `start`: keep the suffix
  - `middle`: split roughly half and half
  - `end`: keep the prefix
- This logic lives in `packages/vue-clamp/src/text.ts`.

## Candidate Extensions

### A. Numeric proportion

- Allow `location` to accept a ratio from `0` to `1`.
- Interpretation:
  - `0` means current `start`
  - `0.5` means current `middle`
  - `1` means current `end`
- For a given kept count:
  - prefix count = `round(kept * ratio)`
  - suffix count = `kept - prefix count`
- This is the smallest meaningful extension because it preserves the current mental model.

## Internal Refactor Direction

- `displayTextForKeptCount()` is currently doing two jobs:
  - interpreting the public `location` API
  - rendering the final collapsed string
- A cleaner structure is:
  1. normalize `location` into one internal placement form
  2. resolve that placement into preserved prefix/suffix counts for a given `kept`
  3. render the final string from those counts

### Preferred normalization

- Normalize keyword `location` values to an internal anchor ratio:
  - `start` -> `0`
  - `middle` -> `0.5`
  - `end` -> `1`
- Numeric `location` values then reuse the same path directly.
- For a given kept budget:
  - `prefix = floor(kept * ratio)`
  - `suffix = kept - prefix`

### Preferred rendering

- Render from one generic code path:
  - prefix text from the start of the grapheme list
  - suffix text from the end of the grapheme list
  - insert ellipsis between them
- Trim only the edge adjacent to the ellipsis:
  - `trimEnd()` on prefix
  - `trimStart()` on suffix
- This removes the current location-specific string-building branches.

### B. Preserve-by-index helpers

- Support an explicit preserve-tail count or anchor index for filename-like cases.
- Example shapes:
  - `preserveEnd={4}`
  - `location={{ type: "index", value: -4 }}`
- Negative index support is attractive for extensions and IDs, but it is less intuitive as an overload of `location` itself.
- A dedicated prop may be clearer than putting index semantics into `location`.

### C. Function-valued strategy

- Support a callback that receives the grapheme count and kept budget, then returns how much prefix/suffix to preserve.
- This is the most flexible option, but it also:
  - makes behavior less declarative
  - complicates typing and docs
  - increases SSR/hydration and referential-stability footguns
  - makes the component harder to reason about and test as a product API

## Recommendation

1. If `location` expands, prefer a numeric ratio first.
2. For filename-style use cases, prefer a separate explicit prop such as `preserveEnd` over overloading `location` with signed indices.
3. Avoid a function-valued public prop unless there is repeated evidence that the declarative API cannot cover real cases.

## Open Questions

1. Should numeric ratios be supported as numbers only, or also as percentage strings?
2. Should `preserveEnd` and similar explicit props compose with ratio-based `location`, or should only one strategy be allowed at a time?
3. Do we want a general “preserve strategy” object eventually, with `location` kept as the simple shorthand?
