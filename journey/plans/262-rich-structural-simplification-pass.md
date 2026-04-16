# 262 Rich structural simplification pass

## Goal

Review the new structural `RichLineClamp` implementation from first principles and remove code that is redundant, overly defensive, or harder to reason about than necessary.

## Focus

- Keep the hidden-probe and structural-decision model.
- Remove duplicated state that can be derived from the decision.
- Avoid applying clamped-only trimming behavior to full-content commits.
- Keep reset/source-change paths direct.
- Preserve existing behavior and browser coverage.
