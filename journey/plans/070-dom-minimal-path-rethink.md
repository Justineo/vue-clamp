# DOM Minimal Path Rethink

## Goal

Re-derive the default DOM-based clamp implementation from first principles and identify the smallest honest architecture that preserves the public API.

## Questions

1. What does the DOM-first component actually need?
2. Which current modules exist because of the dual-entry architecture rather than the DOM path itself?
3. Which responsibilities should be duplicated across default/fast entries instead of abstracted?
4. What is the minimum maintainable split that still keeps the repo understandable?

## Steps

1. Re-read the Vue 2 DOM implementation and the current Vue 3 DOM path.
2. Enumerate essential DOM-path responsibilities versus optional/generalized layers.
3. Record a minimal architecture proposal with concrete deletion/refactor targets.
4. Summarize the recommended direction before making more code changes.
