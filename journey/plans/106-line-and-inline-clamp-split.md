# 106 Line And Inline Clamp Split

## Goal

Evolve the package from one generic `Clamp` export into two explicit component surfaces:

- `LineClamp`: the existing DOM-driven multiline clamp
- `InlineClamp`: a new native single-line clamp with optional `start / body / end` segmentation

## Scope

1. Rename the existing multiline component and its public types.
   - Make `LineClamp` the canonical component name.
   - Keep a `Clamp` compatibility alias for now to avoid an unnecessary hard break.
2. Add `InlineClamp`.
   - Native one-line only.
   - `text` is the source of truth.
   - Optional `split(text) => { start?, body, end? }`.
   - `start` and `end` stay fixed; `body` is the shrinking text-overflow region.
3. Update package exports.
   - Root export should expose `LineClamp`, `InlineClamp`, and the compatibility alias.
   - Add a dedicated `vue-clamp/inline` entry.
4. Update docs, website usage, and project memory.
5. Add contract/browser coverage for the new component and renamed surface.

## Design Decisions

- `InlineClamp` stays native-only and single-line-only.
- The split callback is semantic only; it runs once per text change, not per layout probe.
- `LineClamp` keeps the existing implementation and semantics.
- Compatibility should be additive for now, not a hard rename-only break.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build -r`
