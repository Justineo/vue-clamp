# 196 Fix browser test font-size assertion

## Goal

Repair the browser suite by aligning the demo-page font-size assertion with the current website
control styling.

## Steps

1. Inspect the failing assertion and the current `App.vue` control typography.
2. Confirm whether the regression is in runtime styling or in an outdated test expectation.
3. Update the test to assert the stable behavior the page still guarantees.
4. Re-run the targeted browser test and the browser suite.
