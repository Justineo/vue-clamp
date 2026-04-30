# Mobile controls collapsed state

Date: 2026-04-30

## Goal

Redesign the mobile collapsed state for shared demo controls so it reads as a deliberate mobile
control row rather than a thin divider.

## Decisions

- Use a larger touch target for the collapsed row.
- Show a leading settings icon, title, current-settings summary, and trailing chevron.
- Keep the collapsed row compact enough to remain sticky, but tall enough to be tappable and
  recognizable as a mobile disclosure control.
- Reset the disclosure to collapsed when switching component surfaces.

## Scope

- `packages/website/src/App.vue`
- `packages/vue-clamp/tests/demo-page.browser.test.ts`

## Validation

- Targeted check and demo-page browser test.
- Manual mobile viewport verification.
- Full validation if targeted checks pass.

## Status

Implemented on 2026-04-30.
