# 128 WrapClamp detailed plan

- Consolidated the earlier `WrapClamp` discussion into one research note.
- Recorded the render-strategy decision:
  - dedicated component
  - data-driven `items`
  - `item` plus `before` / `after` slots
- Reversed the earlier `rest` recommendation after discussion:
  - slot naming should align with `LineClamp`
  - hidden-summary semantics should live in slot props and docs, not in a dedicated slot name
- Wrote a phased implementation plan covering API, runtime, measurement, RTL, accessibility, tests, and docs.
- Implemented `WrapClamp` in `packages/vue-clamp/src/wrap.ts`.
- Added root exports and public types for `WrapClamp`.
- Added browser coverage for:
  - line-based clamping
  - max-height clamping
  - `before` / `after` slot behavior
  - expanded toggle behavior
  - RTL placement of the trailing slot
- Updated README and `journey/design.md` to include the third clamp surface.
