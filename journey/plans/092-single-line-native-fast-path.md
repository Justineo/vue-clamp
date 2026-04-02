# 092 Single-Line Native Fast Path

## Goal

Add a narrow browser-native fast path for the collapsed single-line case while preserving the current DOM-driven clamp path for all other configurations.

## Scope

- `packages/vue-clamp/src/component.ts`
- `packages/vue-clamp/src/types.ts` if any internal typing helpers improve clarity
- `packages/vue-clamp/tests/clamp.browser.test.ts`
- `packages/vue-clamp/tests/browser.ts`
- `packages/vue-clamp/README.md`
- `journey/design.md` if the runtime model changes enough to document explicitly

## Fast-Path Contract

The native path should only activate when all of the following are true:

1. The component is collapsed.
2. `maxLines === 1`.
3. `location === "end"`.
4. `maxHeight` is not set.
5. The ellipsis is natively representable:
   - default `text-overflow: ellipsis` for `ellipsis === "…"`
   - optional string-valued `text-overflow` only when the browser reports support
6. The rendered layout can preserve visible `before` and `after` slot content.

If any condition fails, the existing JS clamp path remains the source of truth.

## Design Direction

### 1. Keep one recompute entry point

- Do not fork the component into two separate behavioral components.
- Keep the existing prop watchers, resize observation, and font listeners.
- Make `recompute()` choose between:
  - native single-line overflow measurement
  - current binary-search text trimming

### 2. Split rendering by layout mode, not by feature surface

- The current inline-flow layout works for DOM-trimmed text.
- The native path likely needs a different internal content layout so trailing slot content is not clipped with the text.
- Preferred direction:
  - content row that keeps `before` and `after` wrappers as non-shrinking inline-flex items
  - text wrapper as the only shrinkable item with `min-width: 0`, `overflow: hidden`, `white-space: nowrap`, and `text-overflow`

### 3. Treat native overflow as visual-only

- The native path should detect clamp state from DOM metrics such as `scrollWidth > clientWidth`.
- Do not try to keep native overflow and DOM-trimmed `textContent` in sync at the same time.
- This means tests and docs must explicitly distinguish:
  - visual overflow behavior
  - DOM text content

### 4. Preserve `clampchange` semantics

- `clampchange` should still reflect whether the content is visually clamped.
- Width, text, slot, and font changes must continue to drive recomputation for the native path.
- The initial naive `false -> true` emission sequence should be rechecked for the fast path.

## Open Decisions

1. Should custom string ellipsis be part of the first fast-path rollout, or should v1 only support `ellipsis === "…"`?
2. Should the native path support `before` and `after` slots in v1, or should it intentionally fall back to JS whenever either slot is present?
3. Do we accept that collapsed DOM `textContent` differs between the native and JS paths, or do we want to narrow the fast path further to avoid observable contract drift?

## Proposed Implementation Order

1. Add internal helpers that decide whether native overflow is eligible.
2. Refactor the render tree so a native single-line text wrapper is possible without disturbing the JS path.
3. Implement native clamp detection and wire it into `isClamped`.
4. Add browser coverage for:
   - native-path eligibility
   - `clampchange` behavior
   - width changes
   - slot visibility if supported
   - fallback to JS when the native path is ineligible
5. Update README and `journey/design.md` to document the hybrid runtime.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build -r`

## Success Criteria

- The common single-line end-ellipsis case can render through native overflow without breaking clamp detection.
- Multi-line, `maxHeight`, `start`, `middle`, and unsupported ellipsis cases still use the existing JS path unchanged.
- The resulting component remains readable from one file and does not introduce a second full algorithm surface.
