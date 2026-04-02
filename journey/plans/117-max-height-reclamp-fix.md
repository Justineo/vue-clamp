# Max Height Reclamp Fix

## Goals

- Fix `LineClamp` so increasing `maxHeight` triggers a correct reclamp.
- Add a browser regression test that changes `maxHeight` reactively after mount.

## Changes

1. Recompute the visible clip box for `maxHeight` checks inside each fit probe instead of capturing it once before the search.
2. Add a browser test that increases `maxHeight` and verifies the visible text expands.
3. Record the updated runtime detail in `journey/design.md`.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
