# Reference Header And Hatch Pass

## Goals

- Put the `Component Reference` title and surface tabs in the same header row.
- Remove the installation-specific prompt-code styling so install commands render like regular code.
- Replace the current width/max-height guide accents with subtle diagonal hatch bands.

## Changes

1. Merge the `Component Reference` heading into the reference navigation row.
2. Keep one short scope line under the row.
3. Remove `prompt-code-block` usage and its CSS rule.
4. Redraw `width-guide` and `height-guide` using restrained diagonal hatch gradients.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
