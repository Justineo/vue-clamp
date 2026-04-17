# InlineClamp location

## Goal

Add a `location` prop to `InlineClamp` so callers can choose where the ellipsis is inserted inside the shrinkable `body` segment while preserving `start` and `end` split segments.

## Scope

- Reuse the existing `LineClampLocation` keywords and numeric ratio semantics: `start`, `middle`, `end`, and finite numbers clamped to `0..1`.
- Keep `end` as the default to preserve current behavior.
- Apply location only to the `body` part. `start` and `end` remain fixed visible segments.
- Update public types, runtime prop validation, browser tests, docs/API reference, and the design snapshot.

## Verification

- Run the focused inline browser tests while iterating.
- Run `vp check` and `vp test` before finishing.
