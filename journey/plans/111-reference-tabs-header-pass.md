# Reference Tabs Header Pass

## Goals

- Make the `Component Reference` boundary clearer without reintroducing a nested panel.
- Use a full-width divider and card-style tabs so the navigation visibly owns everything below it.
- Reduce switcher copy to one minimal scope line.

## Changes

1. Replace the current switcher stack with:
   - one full-width divider/navigation row
   - card-style surface tabs
   - one short scope sentence
2. Remove the descriptive paragraphs currently sitting above the reference body.
3. Keep the existing demo/example/api structure and browser test hooks.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
