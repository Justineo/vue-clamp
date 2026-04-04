# Remove Clamp alias

## Goal

- Remove the `Clamp` compatibility alias from the public package surface.
- Update user-facing docs and release notes so the supported multiline import is `LineClamp`.

## Steps

1. Remove the runtime export and type aliases for `Clamp`.
2. Update package tests to reflect the reduced export surface.
3. Update README, migration guide, changelog, and design memory.
4. Run focused package validation.
