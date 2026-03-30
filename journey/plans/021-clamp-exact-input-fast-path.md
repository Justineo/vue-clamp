# Clamp Exact Input Fast Path

## Goal

Avoid redundant clamp recomputation when the effective clamp inputs are exactly unchanged, without reducing responsiveness to real text, layout, font, slot, or limit changes.

## Scope

- `packages/vue-clamp/src/clamp.ts`
- `packages/vue-clamp/tests/clamp.test.ts`
- `journey/design.md`
- `journey/logs/021-clamp-exact-input-fast-path.md`

## Approach

1. Add a small exact-input cache to the internal `Source` state.
   - Cache only the last effective clamp inputs and last result.
   - Scope the cache to the prepared source so it resets naturally when text or font changes.

2. Keep the cache in the clamp core.
   - This avoids benchmark-only logic.
   - It also benefits the production component path and the benchmark adapter through the same code path.

3. Preserve responsiveness.
   - Any change to measured width, line height, slot widths, location, ellipsis, or limits must invalidate the fast path.
   - No monotonic or heuristic skip logic in this pass; exact equality only.

4. Add regression coverage.
   - Verify repeated identical calls reuse the cached result instead of invoking another layout pass.

## Validation

- `vp fmt`
- `vp check`
- `vp test`

## Acceptance Criteria

- Repeated identical clamp calls hit a fast path.
- Real input changes still produce fresh results.
- The optimization lives in shared production code, not only in benchmark code.
