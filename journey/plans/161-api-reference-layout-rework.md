# API reference layout rework

## Goal

Replace the dense API tables in the website reference section with a layout that keeps names and type signatures readable at the page width.

## Changes

- switch props, slots, slot props, and events from wide tables to stacked reference rows
- keep the API content brief, but preserve the explicit slot-prop documentation
- retain the existing notes blocks and tested wording unless the layout requires minor copy updates

## Validation

- `vp fmt packages/website/src/App.vue`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
