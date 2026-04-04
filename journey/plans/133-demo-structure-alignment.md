## Goal

Align the demo-section structure across `LineClamp`, `InlineClamp`, and `WrapClamp` on the website so the three surfaces feel like one documentation system.

## Scope

- Normalize the demo panel into the same high-level structure across all three components.
- Remove the special-case standalone inline controls block.
- Keep the existing demos and controls, but group them into a clearer shared-controls-plus-examples rhythm.

## Steps

1. Inspect the current `Demo` branch markup for all three surfaces.
2. Introduce shared wrappers/classes so each surface uses the same visible hierarchy.
3. Update CSS only where needed to support the aligned structure without adding extra chrome.
4. Run formatting/type checks and update the work log.
