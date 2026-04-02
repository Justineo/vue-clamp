# Inline Toggle Underfill At 373

## Goal

Investigate why the demo's inline-toggle scenario appears underfilled at `373px`, with more slack after the `after` slot than the clamp result seems to justify.

## Plan

1. Reproduce the `373px` case on the real demo page from both a clean load and width-sweep history.
2. Compare the rendered last-line slack with the measured `after` slot width and the clamp engine's selected text candidate.
3. Determine whether the underfill comes from conservative `after`-slot budgeting, stale correction state, or line-width accounting.
4. Implement and validate a fix if the clamp is demonstrably reserving more width than needed.
