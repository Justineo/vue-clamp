# Rich ellipsis placement and demo controls

Date: 2026-04-30

## Questions

1. Where should `RichLineClamp` place the ellipsis when the truncation point is inside an inline
   element such as `<code>`?
2. Should component demo controls be reorganized into shared sticky controls beneath the component
   tabs?

## Rich ellipsis placement recommendation

Use an outer marker as the default rule:

- If the truncation point is inside text owned by an inline formatting element, keep the retained
  inline element content and append ellipsis as a plain text node at the `RichLineClamp` body root.
- Example: `<code>release-candidate-build</code>` cut inside the code text becomes
  `<code>release-candidate</code>…`.
- If the truncation point is after an atomic run or an element boundary, use the same root-level
  plain text ellipsis.
- Example: a cut after a whole `<code>release</code>` run also becomes `<code>release</code>…`.

Rationale:

- CSS native multiline clamping treats the ellipsis as a clamp marker owned by the clamping block,
  not as text inserted into the deepest inline element.
- The component should keep the same mental model: retained rich markup stays rich; the ellipsis is
  a plain outer marker.
- It avoids making the ellipsis inherit semantics or styling from elements such as `<code>`,
  `<strong>`, or `<a>`.

Do not introduce a public rich ellipsis placement prop yet. If a need appears later, consider an
internal enum first:

```ts
type RichEllipsisScope = "inline" | "outside";
```

## Location semantics

`RichLineClamp` remains end-only. `location` is not added to rich mode in this step.

Reasoning:

- Start/middle rich clamping would require preserving both a prefix and suffix of a DOM tree.
- The current rich patch engine is prefix-oriented and optimized around stable-prefix patching.
- Supporting middle rich truncation is a separate architecture problem, not a small extension of
  word-boundary support.

## Demo controls recommendation

Refactor each component surface into:

- sticky surface-level controls directly under the component tabs
- example-local controls only for settings that are unique to one example
- preview rows below the shared controls

Shared controls by surface:

- `LineClamp`: text preset/editor, boundary, hyphens, direction, and shared width baseline if the
  examples can tolerate it
- `RichLineClamp`: rich preset/editor, boundary, hyphens, and width baseline
- `InlineClamp`: boundary, location, ratio, and width
- `WrapClamp`: direction and shared width/line limit only if they map cleanly across examples

Keep per-example controls for:

- `max-lines` vs `max-height`
- expansion toggles
- example-specific width/height when visual comparison depends on it
- `clampchange` demonstrations

Sticky behavior:

- The shared control bar should stick below the component tabs, not the viewport top.
- On small screens it should be horizontally scrollable or wrap to two compact rows without covering
  preview content.
- Avoid nested cards; treat the sticky controls as a quiet toolbar band within the component
  reference section.

## Implementation sequence

1. Lock rich ellipsis placement with browser tests for cuts inside `<code>` and after a whole
   inline element.
2. Extract a small `BoundaryControls` or reuse `PillControls` with shared state; do not introduce a
   new design system layer.
3. Make the existing component tabs row sticky if it is not already, then place a sticky
   surface-controls row immediately beneath it.
4. Move duplicated controls into the surface controls and leave only truly local controls in each
   demo block.
5. Update demo-page tests to assert the shared controls exist and affect all relevant examples.

## Status

Implemented on 2026-04-30.

- `RichLineClamp` now appends clamped ellipsis as a root-level text marker.
- The website demos now use sticky shared controls beneath the component tabs for all four
  surfaces.
- Shared surface controls own cross-example settings:
  - `LineClamp`: source text, boundary, width, hyphens, direction
  - `RichLineClamp`: source HTML, boundary, width, hyphens
  - `InlineClamp`: location, boundary, ratio, width
  - `WrapClamp`: width, direction
- Example-local controls now stay limited to example-specific options such as max lines, max
  height, expansion, ellipsis, and event status.
