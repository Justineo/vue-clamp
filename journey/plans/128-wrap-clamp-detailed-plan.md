# WrapClamp detailed plan

## Goal

Design and implement a third clamp surface, `WrapClamp`, for wrapped atomic items such as badges, tags, or pills, while keeping the package browser-aligned and readable.

## Intended v1 shape

- dedicated component: `WrapClamp`
- source model: `items`
- clamp unit: whole item boxes
- limits: `maxLines` and/or `maxHeight`
- expansion model aligned with `LineClamp`
- slots:
  - `item`
  - `before`
  - `after`

## Success criteria

- The component can clamp a wrapped item list by visible lines or visible height.
- Items are preserved atomically; no partial item clipping.
- `before` and `after` can be used for visible adornments or `More` / `Less` / `+N` style UI.
- Hidden-item metadata is available to slot content.
- RTL works through inherited browser direction without special-case item reversal.
- The runtime stays small enough to understand from one component file.

## Phase 1: finalize the public surface

Decide and document:

- component name: `WrapClamp`
- props:
  - `items`
  - `itemKey`
  - `as`
  - `maxLines`
  - `maxHeight`
  - `expanded`
- events:
  - `update:expanded`
  - `clampchange`
- slots:
  - `item`
  - `before`
  - `after`
- exposed instance:
  - `expand()`
  - `collapse()`
  - `toggle()`
  - readonly `clamped`
  - readonly `expanded`

Open decision to resolve here:

- whether `after` gets a default fallback like `+N` when omitted

## Phase 2: type and export scaffolding

Add public types in `packages/vue-clamp/src/types.ts`:

- `WrapClampProps`
- `WrapClampSlotProps`
- `WrapClampExposed`
- helper item-key type

Add root exports in `packages/vue-clamp/src/index.ts`.

Update README surface summary once the API is stable.

## Phase 3: runtime architecture

Create one new component file, likely `packages/vue-clamp/src/wrap.ts`.

Recommended internal state:

- `expanded`
- `isClamped`
- `visibleCount`
- `hiddenCount`
- `hiddenItems`

Recommended refs:

- root
- wrapping content host
- measured item shells
- optional `before` / `after` shells

Keep the runtime browser-driven:

- render live DOM
- measure real item positions
- use `ResizeObserver`
- use font readiness like `LineClamp`

## Phase 4: measurement algorithm

Collapsed mode algorithm:

1. render the full item list in measurement-ready shells
2. determine row positions from `offsetTop` or normalized rect tops
3. compute the provisional last fitting item for `maxLines` and/or `maxHeight`
4. if an `after` slot will render while clamped:
   - render it with current slot props
   - remeasure
   - back off visible items until the trailing slot fits too
5. commit `visibleCount`, `hiddenCount`, and `isClamped`

Expanded mode:

- render all items
- keep `before` / `after` available
- `hiddenCount` becomes `0`

Important policy:

- preserve only contiguous visible prefixes in v1

## Phase 5: rendering contract

Recommended render tree:

- root element from `as`
- one inline/flex wrapping host
- optional `before` shell
- visible item shells generated from `items.slice(0, visibleCount)`
- optional `after` shell

Do not render hidden items visibly.

If hidden item data is needed for slot props:

- derive it from `items.slice(visibleCount)`

## Phase 6: slot prop contract

Use a shared slot-props object for `before` / `after`:

- `clamped`
- `expanded`
- `visibleCount`
- `hiddenCount`
- `hiddenItems`
- `expand`
- `collapse`
- `toggle`

Use a simpler per-item slot:

- `item`
- `index`

If payload size becomes a concern later, `hiddenItems` can become optional or gated by a prop, but do not optimize that prematurely.

## Phase 7: accessibility and RTL

Accessibility:

- keep DOM order logical
- do not hide information from assistive tech in a surprising way
- trailing `after` content should be user-owned, so document accessible label responsibility when it renders a button or summary

RTL:

- rely on inherited browser direction
- avoid any left/right-specific API
- use logical order only
- ensure measurement depends on row/block position rather than inline direction

## Phase 8: test plan

Add component and browser coverage for:

- one-row and multi-row clamping
- `maxLines`
- `maxHeight`
- variable item widths
- `before` slot only
- `after` slot only
- `after` rendering `+N`
- `after` rendering `More` / `Less`
- expanded toggle behavior
- hidden count correctness
- RTL layout
- resize-driven reclamping

Prefer browser tests for the fit logic because this component is even more layout-dependent than `LineClamp`.

## Phase 9: docs and website demo

Update README:

- introduce `WrapClamp`
- clarify the atomic-item model
- explain that `after` is the recommended place for summary or expansion UI

Update docs site:

- add `WrapClamp` to the component tabs
- include one demo with `+N`
- include one demo with `More` / `Less`
- include one RTL example
- keep the page simple; do not overbuild the demo controls

## Phase 10: validation

Validation standard:

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build -r`

## Risks

- `after` width can create nontrivial convergence behavior when hidden counts change.
- Very dynamic item content may trigger repeated measurements.
- Browser layout differences can make row detection fragile if implemented with physical-axis assumptions.

## Risk controls

- keep item order logical
- measure by block-axis position
- use a small iterative backoff loop rather than speculative summary rendering
- avoid cache-heavy optimizations until profiling shows a need

## Explicit non-goals for v1

- generic child-vnode introspection
- partial clipping inside items
- built-in dropdown overflow menus
- row virtualization
- start/end keep policies
- grid-aware clamping
