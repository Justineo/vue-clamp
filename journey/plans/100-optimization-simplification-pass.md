# 100 Optimization Simplification Pass

## Goal

Reduce the complexity introduced by the first optimization batch while keeping the highest-signal wins:

- keep prepared-text caching by `text`
- keep the smaller per-candidate fit check
- remove previous-result-guided search and its component state

## Steps

1. Simplify the clamp core.
   - Remove the `previousKept` search hint path.
   - Return to one straightforward binary search flow.
2. Simplify component state.
   - Remove `lastJsResult` and related helpers.
   - Keep only the prepared-text cache needed for source reuse.
3. Update design memory to match the simplified runtime.
4. Validate.
   - `vp check`
   - `vp test`
   - `vp run test:browser`

## Outcome Target

- source preparation stays cached by text
- the runtime reads clearly again from top to bottom
- no public behavior changes
