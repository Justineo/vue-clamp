# Naming Clarity Pass

## Goal

Rename internal identifiers that became too terse to read comfortably, while keeping the code compact and avoiding a swing back to verbose naming.

## Scope

- `packages/vue-clamp/src/VueClamp.ts`
- `packages/vue-clamp/src/slot-text.ts`
- `packages/vue-clamp/src/measurement.ts`
- `packages/vue-clamp/src/benchmark/pretext-dom.ts`
- `journey/logs/022-naming-clarity-pass.md`

## Focus

- Fix names that are ambiguous out of context, such as:
  - `plainText`
  - `offFonts`
  - `px`
  - `boxY`
  - other similarly compressed names in the component state flow
- Leave names alone when the surrounding context already makes them clear.

## Plan

1. Rename only the unclear identifiers.
   - Favor short but natural names.
   - Avoid large-scale churn in files that are already readable.

2. Keep behavior unchanged.
   - This is a clarity pass, not a functional refactor.

3. Validate.
   - Run `vp fmt`.
   - Run `vp check`.
   - Run `vp test`.

## Acceptance Criteria

- The confusing overly-short names are gone.
- The code remains compact.
- No behavior changes are introduced.
