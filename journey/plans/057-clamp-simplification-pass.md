# Clamp Simplification Pass

## Goal

Refine the latest inline-toggle bugfix so the clamp component keeps the same behavior with less duplication and clearer structure.

## Review Findings

- `component.ts` currently re-measures width, slot widths, and font data just to manage the overflow-correction loop, even though `dom-clamp.ts` already reads those same values.
- The overflow-correction state names are generic (`widthAdjustment`, `measurementSignature`) rather than describing the correction purpose directly.
- `MeasuredClampResult.containerWidth` is currently returned but not used by the component.

## Plan

1. Push more of the measured DOM snapshot through `dom-clamp.ts` so the component does not duplicate width/font/slot reads.
2. Rename the overflow-correction state and helpers for intent rather than mechanism.
3. Keep the browser-visible line verification behavior, but make the orchestration read as one small correction pass instead of ad hoc state.
4. Re-run `vp check --fix`, `vp test`, `vp run test:browser`, and `vp run build -r`.
