# Hero Balanced Random Use Cases

## Goal

- Balance the animated hero use cases across `LineClamp`, `InlineClamp`, and `WrapClamp`.
- Randomize the order without letting one category cluster.

## Steps

1. Define category-based hero use-case pools in `packages/website/src/App.vue`.
2. Generate a randomized interleaved sequence with even category distribution.
3. Update hero measurement and fallback copy to use the new pool.
4. Validate with the existing browser test.
