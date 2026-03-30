# Aggressive Simplification Pass

## Goal

Reduce the codebase to the smallest clear version that still preserves current behavior.

## Focus

1. Delete stale benchmark/report fields and dead shape that no longer reaches the UI.
2. Tighten names in the dense internal modules so the code reads locally without verbose type and variable names.
3. Collapse low-value indirection where the current code is carrying extra surface without real leverage.

## Non-goals

- No speculative architecture rewrite.
- No feature changes unless a behavior is already incorrect.
- No public API removal unless the surface is clearly internal or unused in the repo.

## Actionable Steps

1. Simplify benchmark types and report shape.
   - Remove unused scenario/report fields.
   - Remove unused methodology/environment payload.
   - Simplify wins and speedup reporting to the fields the page actually uses.

2. Simplify benchmark page code.
   - Shorten local names.
   - Remove redundant intermediate types and helpers where they do not improve clarity.

3. Simplify production internals.
   - Shorten dense internal naming in `VueClamp.ts`, `clamp.ts`, `measurement.ts`, and `slot-text.ts`.
   - Collapse low-value helpers only when it makes the local flow easier to read.

4. Validate and document.
   - Run `vp check`.
   - Run `vp test`.
   - Run `vp run build -r`.
   - Update `journey/design.md` and the matching log with concrete simplifications and any tradeoffs.
