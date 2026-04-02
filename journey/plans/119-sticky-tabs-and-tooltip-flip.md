# Sticky Component Tabs And Tooltip Flip

## Goals

- Make the website component tabs stick to the top of the viewport while their section is in view.
- Keep the component tab tooltips above or below the tabs, not off to the side.
- Let anchor-positioned tooltips flip to the opposite side when viewport space is constrained.

## Changes

1. Make the `reference-tabs-row` sticky with a solid page background and elevated stacking.
2. Update `ComponentTabs` so anchor-positioned tooltips use viewport-aware fixed positioning.
3. Use `position-try-fallbacks` and `position-try-order` so the tooltip can prefer the side with more vertical room.

## Validation

- `vp check --fix`
- `vp run test:browser`
