# 263 Rich structural second simplification pass

## Goal

Run a second focused simplification pass over the new structural `RichLineClamp` path.

## Scope

- Avoid introducing named constants for trivial full rich decisions.
- Replace inferred non-null component-local rich types with the direct exported type.
- Collapse parallel probe element state into one small object.
- Keep behavior unchanged and avoid broad architectural changes.
