# Inline Toggle Width Bug

## Goal

Fix the website demo regression where the "Max lines with inline toggle" scenario shows a fourth visible line at `585px` even though the clamp is configured for three lines.

## Root Cause Hypothesis

- The demo uses IBM Plex Sans with browser kerning and ligature shaping enabled.
- The clamp engine currently measures against font shorthand only and does not model those extra OpenType shaping adjustments.
- At the `585px` edge case, the browser's rendered line widths exceed the measured widths enough to push the `after` slot onto a fourth line.

## Scope

- `packages/website/src/style.css`
- `packages/vue-clamp/tests/demo-page.browser.test.ts`
- `journey/design.md`

## Plan

1. Constrain the measured demo typography so browser shaping matches the clamp engine's measurement assumptions.
2. Keep a browser regression on the actual website page for the `585px` inline-toggle case.
3. Record the measurement constraint in journey memory and rerun the browser/site validation flow.
