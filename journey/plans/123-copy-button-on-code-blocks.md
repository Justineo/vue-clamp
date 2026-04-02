# Copy Button On Code Blocks

## Goal

Add a copy button to website code blocks without making `App.vue` heavier.

## Plan

1. Create a small website-only code block wrapper that renders Shiki HTML or plain code and owns copy state.
2. Replace installation and example code block usage in `App.vue` with the wrapper.
3. Add browser coverage for the copy button and verify with `vp check` and `vp run test:browser`.
