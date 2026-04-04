## Goal

Polish the first `WrapClamp` website demo so it reads as an actual tab strip with an icon-only overflow trigger.

## Requested changes

- Make the first wrap demo visually resemble tabs rather than pills.
- Keep the overflow trigger as an icon-only dropdown button with no hidden-count badge.
- Make the dropdown interaction useful:
  - open and close
  - allow selecting a hidden tab from the menu
  - surface the selected tab in the visible strip

## Approach

- Add local selected/open state for the tabs demo in `App.vue`.
- Reorder the source items so the selected tab is moved to the front before rendering.
- Render visible items as tabs with an active state.
- Render hidden items inside the `after` menu and close the menu when a hidden item is selected.
- Keep the rest of the `WrapClamp` docs surface unchanged.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
- `vp run build -r`
