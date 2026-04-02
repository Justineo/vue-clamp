# Component Tab Tooltips

## Goals

- Remove the extra component description line from the website section.
- Move minimal component descriptions onto each tab as a tooltip.
- Keep the `Components` section as heading, switcher, and switched content only.

## Changes

1. Attach short descriptions directly to the tab options in the website page.
2. Teach `ComponentTabs` to expose those descriptions via native tooltips.
3. Delete the standalone description row and related styling.

## Validation

- `vp check --fix`
- `vp run test:browser`
