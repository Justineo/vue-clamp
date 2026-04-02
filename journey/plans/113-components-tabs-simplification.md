# Components Tabs Simplification

## Goals

- Rename the website section from `Component Reference` to `Components`.
- Redesign the tabs as `ComponentTabs`.
- Remove the extra scope copy and keep only one short selected-component description.
- Remove the hatch decorations while keeping the actual width/max-height borders.

## Changes

1. Replace `SurfaceTabs` with `ComponentTabs`.
2. Update the section heading and header copy.
3. Simplify component descriptions to one sentence each.
4. Delete the hatch pseudo-elements and keep only the border indicators.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
