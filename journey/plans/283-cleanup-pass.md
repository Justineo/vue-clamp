# Cleanup pass

## Goal

Sweep the current branch changes as a cohesive implementation, not as isolated naming fixes. Preserve behavior while simplifying naming, helper boundaries, and recently added demo/stress-playground code.

## Scope

- Review recently changed library code around clamp preparation, native clamp mode selection, layout helpers, rich/text/wrap clamp flows, and tests.
- Review recently added website demo code, including stress playground, FPS meter, overlay scrollbar integration, and demo controls.
- Keep changes behavior-preserving unless a bug or inconsistency is found.

## Checks

- Prefer clearer names that describe domain intent rather than CSS implementation details.
- Remove helper abstractions that do not carry their weight.
- Keep public API and documented behavior unchanged.
- Run `vp check`, `vp test`, `vp run test:browser`, and `vp run build`.
