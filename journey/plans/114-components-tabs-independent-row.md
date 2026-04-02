# Components Tabs Independent Row

## Goals

- Move the component switch onto its own full-width row under the `Components` heading.
- Redesign the tabs so they read like section-level navigation instead of standalone pills.
- Keep the selected-component copy to one short sentence and avoid adding new chrome.

## Changes

1. Separate the section intro from the tab row in the website layout.
2. Restyle `ComponentTabs` as a broad tab bar with a clearer active state.
3. Keep the selected component description brief and place it near the section intro.

## Validation

- `vp check --fix`
- `vp run test:browser`
