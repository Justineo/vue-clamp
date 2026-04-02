# 105 Affix Clamp Generalization Brainstorm

## Question

If `vue-clamp/filename` exists as a native-only specialized entry, should it stay filename-specific or be generalized to cover more one-line affix-preserving truncation scenarios?

## Scenarios

1. Filename
   - Keep extension visible: `.png`, `.jpeg`, `.d.ts`, `.tar.gz`
2. Email
   - Keep domain visible: `user-name@example.com`
3. URL / host
   - Keep host or trailing path segment visible
4. Path
   - Keep the last segment visible while shrinking middle directories
5. IDs / hashes / addresses
   - Keep both start and end visible
6. Package / scope names
   - Keep namespace prefix or suffix visible

## Options

### A. Keep `FilenameClamp` narrow

- Export only `vue-clamp/filename`
- Optimize for:
  - one line
  - native layout only
  - basename shrink + fixed extension

Pros:

- smallest API
- easiest to explain
- strongest semantics

Cons:

- cannot naturally cover email / path / hash patterns

### B. Generalize one level to an affix-preserving primitive

- Build an internal or public primitive that preserves fixed edge segments and lets the middle shrink.
- `FilenameClamp` becomes a thin wrapper over that primitive.

Possible model:

- fixed `start`
- shrinking `middle`
- fixed `end`

Pros:

- covers several common one-line truncation cases
- still native-only and simple
- avoids filename-specific logic inside the base primitive

Cons:

- more abstract naming problem
- risk of overexposing low-level API too early

### C. Jump to fully programmable semantics

- callback-based splitting / strategies / parsers

Pros:

- maximum flexibility

Cons:

- much higher API complexity
- harder docs and test matrix
- likely premature

## Recommendation

Choose B internally, but expose A first.

- Internally, implement a small single-line native `start / middle / end` primitive.
- Publicly, ship `vue-clamp/filename` first.
- Only expose the generalized primitive if a second real scenario appears and proves the abstraction.

## Typical Next Public Steps

1. `vue-clamp/filename`
2. If demand appears, consider `vue-clamp/affix` or `vue-clamp/inline`
3. Avoid callback-heavy programmable split APIs unless several strong use cases still do not fit
