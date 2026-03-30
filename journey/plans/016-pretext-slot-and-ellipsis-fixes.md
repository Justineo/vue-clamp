# Pretext Slot And Ellipsis Fixes

## Goal

Fix two regressions in the production Vue 3 Pretext implementation:

1. clamped text must visibly render the ellipsis string
2. `before` / `after` slot widths, especially `after` content that depends on `clamped`, must be fully reflected in the final clamp result

## Investigation Focus

1. Verify whether the production DOM is rendering the computed clamped string or falling back to CSS clipping.
2. Verify whether slot-width measurement converges after `clamped` flips and an `after` slot appears.
3. Compare the production render structure against the legacy DOM-based implementation to avoid avoidable layout mismatches.

## Actionable Steps

1. Add regression coverage first.
   - Add a component test that a collapsed clamp renders an ellipsis.
   - Add a component test that a conditional `after` slot causes a second-pass clamp result that reserves slot width.

2. Fix the production render/layout path.
   - Remove any unnecessary wrapper/layout behavior that diverges from the legacy inline layout model.
   - Ensure `after` slot width can converge after `clamped` changes.

3. Fix the clamp math if needed.
   - Ensure the final candidate always reserves the visible slot widths actually rendered in the DOM.

4. Validate in browser.
   - Run `vp check`.
   - Run `vp test`.
   - Run `vp run build -r`.
   - Verify the live demo visually.
