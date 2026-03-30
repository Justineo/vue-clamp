# No-Overengineering Pass

## Goal

Remove logic that is redundant, weakly justified, or merely wrapping existing behavior without adding value, while keeping the Vue 3 API and the current no-flash behavior intact.

## Scope

- Remove duplicate or unnecessary caches in the clamp engine.
- Remove redundant reactive wrappers and helper state in the component.
- Keep only the DOM reads that are required to provide Pretext with real layout inputs.
- Record the simplification rationale in `journey/`.

## Non-Goals

- Breaking the public `0.4.1` API.
- Removing DOM reads that are still required for container width, font, line height, or slot widths.
- Replacing the Pretext engine.

## Action Plan

1. Simplify the clamp engine.
   - Remove the extra prepared-text cache and rely on Pretext's own caching.
   - Remove the global grapheme cache and compute graphemes per clamp computation.
   - Keep the binary-search logic, but reduce helper indirection.

2. Simplify the component state model.
   - Remove redundant helpers such as computed wrappers and setter wrappers that do not materially reduce complexity.
   - Keep the current render/update flow, but cut unnecessary indirection.

3. Update project memory.
   - Document which DOM reads remain necessary and why.
   - Record the simplification pass and remaining justified complexity.

4. Validate.
   - Run `vp check`, `vp test`, and `vp run build -r`.

## Progress

- [x] 1. Simplify the clamp engine
- [x] 2. Simplify the component state model
- [x] 3. Update project memory
- [x] 4. Validate
