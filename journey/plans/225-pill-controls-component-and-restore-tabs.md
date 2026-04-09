# Plan

## Goal

Undo the attempt to make `ComponentTabs` look like the generic pill controls, and instead create a
dedicated reusable `PillControls` component for the install/demo preset groups.

## Steps

1. Restore `packages/website/src/ComponentTabs.vue` to its specialized visual styling.
2. Replace the shared global pill stylesheet with a reusable `PillControls.vue` component for
   install tabs and demo preset groups.
3. Update design memory and rerun the website validation stack.
