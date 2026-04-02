# Website Structure And Visual Clarity Pass

## Goals

- Make the Features section shorter and more product-focused.
- Move installation directly after Features.
- Make it visually obvious which content is controlled by the surface tabs.
- Add sketch-style decoration to the width and max-height demo guides without making the page noisy.

## Structure

1. Keep `Features` short.
2. Move `Usage > Installation` to immediately follow `Features`.
3. Replace the loose tabs placement with one bounded `Component Reference` section.
4. Put `Demo`, `Usage`, and `API` inside that bounded area so the selected surface clearly scopes all three.

## Visual Direction

- Keep the page restrained and document-like.
- Use one light framed panel for the tab-controlled area.
- Add a small eyebrow / lead sentence that says the tabs control the content below.
- Add subtle hand-drawn style corner/border accents for the `max-height` and width guides:
  - right-side guide for width
  - bottom-side guide for max-height

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
