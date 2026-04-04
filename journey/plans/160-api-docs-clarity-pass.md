# API docs clarity pass

## Goal

Rewrite the website API reference for `LineClamp`, `InlineClamp`, and `WrapClamp` so it is shorter, clearer, and easier to scan.

## Changes

- tighten prop and note copy
- rename slot table header from `Scope` to `Slot props`
- add explicit slot-prop reference tables for components with slots
- remove placeholder `--` defaults and leave unavailable cells blank
- improve API table readability with small layout and typography adjustments

## Validation

- `vp fmt packages/website/src/App.vue`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
