# Final Elimination Pass

## Goal

Continue simplifying the clamp component until the remaining complexity is either required by the public API or required to supply Pretext with real layout inputs.

## Scope

- Remove reactive state that does not participate in rendering or Vue dependency tracking.
- Tighten naming where it helps distinguish render-time data from settled clamp state.
- Leave the current no-flash behavior and public API unchanged.

## Action Plan

1. Remove non-render reactive state.
   - Replace the reactive source-text holder with plain component state.
   - Keep only reactive values that actually drive render output or watchers.

2. Tighten names and flow.
   - Make the distinction between render-snapshot source text and settled clamp source text explicit.
   - Remove helper naming that still reflects older implementation details.

3. Validate and record.
   - Run `vp check`, `vp test`, and `vp run build -r`.
   - Update `journey/design.md` and the matching log with the new simplification boundary.

## Progress

- [x] 1. Remove non-render reactive state
- [x] 2. Tighten names and flow
- [x] 3. Validate and record
