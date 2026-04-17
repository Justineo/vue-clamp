# InlineClamp simplification refactor

## Goal

Make the measured `InlineClamp` implementation as small and conventional as possible while keeping
the current one-line affix-friendly behavior unchanged.

## Redundant or inconsistent pieces to remove

1. Avoid a separate content wrapper when the root can be the measured inline content.
2. Avoid callback-based body ref plumbing when a normal Vue ref matches local component style.
3. Delete the old boundary-space preservation path now that segments are normal inline spans.
4. Avoid defensive split-result normalization and body-size observation that do not serve the
   current public contract.
5. Avoid custom width-limit logic unless tests prove it is still needed after measuring the root.

## Plan

1. Refactor `InlineClamp` around the same local lifecycle shape as `WrapClamp`: refs, local
   recompute, `ResizeObserver`, font-load invalidation, and a compact render closure.
2. Keep only the shared primitive that clearly reduces duplication: `searchKeptCount` from
   `text.ts`.
3. Reduce naming to local context (`body`, `parts`, `limit`, `fits`) and remove extra data passing.
4. Validate with focused inline browser tests first, then run the project checks/tests.
