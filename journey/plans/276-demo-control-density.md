# Demo control density and mobile disclosure

Date: 2026-04-30

## Goal

Refine the website demo control bars so they feel like one compact product control surface instead
of a loose set of wrapped form fields.

## Decisions

- Use fixed geometry for sticky stacking:
  - component tabs get a fixed block size
  - shared controls use that same size as their sticky `top`
- Normalize single-line controls around one control height:
  - pill buttons
  - range rows
  - checkboxes
  - text inputs
  - labels
- Keep labels vertically centered in shared controls.
- Preserve larger source editors above the sticky controls; only compact shared controls become
  sticky.
- On narrow screens, shared controls collapse behind a compact toggle button and expand in place.

## Scope

- `packages/website/src/ComponentTabs.vue`
- `packages/website/src/PillControls.vue`
- `packages/website/src/App.vue`
- `packages/vue-clamp/tests/demo-page.browser.test.ts`

## Validation

- Run targeted formatting/checks.
- Run demo-page browser tests.
- Run full check/test/browser/build if targeted validation passes.
- Verify desktop and narrow-screen behavior in the browser.

## Status

Implemented on 2026-04-30.
