# Source module why comments

Date: 2026-05-01

## Goal

Add concise comments to the source modules so future maintainers can recover why each module exists
and why the main runtime branches are present.

## Scope

- Comment `packages/vue-clamp/src` modules, not generated outputs or benchmark data.
- Prefer module-level and branch-level comments over line-by-line narration.
- Preserve behavior and public API exactly.

## Validation

- Run `vp check`.
- Run focused tests if formatting or lint reveals changed code structure.
