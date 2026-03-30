# Review Fix Batch

## Goal

Address the reasonable issues confirmed by the latest external review and the internal self-review:

1. Keep the initial hidden gate until measurement truly succeeds.
2. Avoid the spurious initial `clampchange(false)` before the first real clamp state is known.
3. Keep middle-mode benchmark baselines semantically aligned with the production implementation.
4. Make the full-text accessibility hook explicit enough that tests can stop using `aria-label` as a structural selector.
5. Tighten `fontShorthand()` so the fallback always forms a valid shorthand.

## Scope

- `packages/vue-clamp/src/VueClamp.ts`
- `packages/vue-clamp/src/measurement.ts`
- `packages/vue-clamp/benchmark/dom/*.ts`
- `packages/vue-clamp/tests/*.ts`
- `packages/vue-clamp/README.md`
- `journey/design.md`
- `journey/logs/028-review-fix-batch.md`

## Plan

1. Fix readiness and `clampchange` emission in the component.
2. Align the benchmark DOM middle split with the production middle split.
3. Update tests for hidden-first-mount recovery, `clampchange`, and the text node selector.
4. Tighten the font shorthand fallback and refresh docs/design notes.
5. Validate with `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
