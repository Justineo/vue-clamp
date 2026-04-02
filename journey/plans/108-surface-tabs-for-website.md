# Surface Tabs For Website

## Goal

Add a lightweight tab switcher for `LineClamp` and `InlineClamp` so the website can focus on one surface at a time.

## Direction

- Build one narrow website-only tabs component.
- Place it near the top of the page after the feature list.
- Use a single selected surface state to drive:
  - the demo section
  - the usage section
  - the API section

## Why

- The current page now repeats headings and tables for both surfaces.
- The package is small enough that one active-surface view is easier to scan than a long stacked document.
- Tabs keep the page simple while still showing that the package has two distinct components.

## Constraints

- Default to `LineClamp` so current expectations and browser tests stay stable.
- Keep the tabs component visually quiet and consistent with the page.
- Avoid fake-heavy tab semantics or complex panel nesting.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
