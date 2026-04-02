# Architecture Contract Refactor

## Goal

Apply the practical architecture fixes from the dual-engine review without changing the public component API:

- make the DOM engine depend on an explicit host contract instead of reconstructing the shell shape implicitly
- collapse the engine backend interface to a single recompute operation
- centralize clamp limit normalization so engines stop inferring policy from shell-applied styles
- narrow benchmark access to production internals behind a small internal adapter surface

## Scope

- `packages/vue-clamp/src/*`
- `packages/vue-clamp/benchmark/*`
- relevant tests and website benchmark integration
- `journey/design.md`

## Steps

1. Introduce shared internal host/limit contracts and update engines to consume them.
2. Remove `onSourceTextChange()` from the engine interface and push engine caching fully behind `recompute()`.
3. Add a small internal benchmark adapter module so benchmark code stops importing engine-private files directly.
4. Add or adjust tests around the new seams.
5. Run `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
