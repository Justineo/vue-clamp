# Anchor Tooltips For Component Tabs

## Goals

- Replace the native `title` tooltip on the component tabs with a custom tooltip.
- Use CSS anchor positioning as a progressive enhancement.
- Keep a simple absolute-positioned fallback for browsers without anchor positioning support.

## Changes

1. Render tooltip elements in `ComponentTabs`.
2. Scope each tooltip to its corresponding tab using `anchor-scope`, `anchor-name`, `position-anchor`, and `position-area`.
3. Add a small browser assertion for tooltip content and the removed standalone description row.

## Validation

- `vp check --fix`
- `vp run test:browser`
