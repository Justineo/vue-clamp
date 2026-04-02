# Inline Demo Restructure

## Goal

Make the `InlineClamp` demo simpler and more document-like by removing the in-demo preset tabs and listing the examples directly, similar to the `LineClamp` demo blocks.

## Changes

1. Replace the single selectable inline example with a shared width control and stacked example blocks.
2. Refresh the sample data:
   - file list item with common image extension splitting
   - shorter email domain
   - home-relative path example
3. Update the inline code example to match the new image-extension scenario.
4. Update browser tests to assert the stacked example layout instead of button-driven switching.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
