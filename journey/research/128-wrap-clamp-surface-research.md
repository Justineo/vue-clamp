# WrapClamp surface research

## Context

We are exploring a third clamp surface for wrapped atomic items such as badges, tags, pills, or chips.

Current package surfaces:

- `LineClamp`: multiline text clamping
- `InlineClamp`: single-line native affix-friendly clamping

The proposed surface should cover cases where the visible unit is a whole item rather than a substring.

## Why this should be a dedicated component

This should not be a new `LineClamp` mode.

Reasons:

- `LineClamp` is text-first and clamps by grapheme budget.
- A wrapped-item clamp is item-first and clamps by whole rendered boxes.
- Mixing both into one surface would blur the unit of preservation and make the API harder to explain.

Recommended direction:

- introduce a dedicated third surface rather than extending `LineClamp`

## Naming exploration

Options considered:

- `TagClamp`
- `BadgeClamp`
- `ListClamp`
- `FlowClamp`
- `WrapClamp`

Recommendation:

- `WrapClamp`

Reasons:

- aligns with `LineClamp` and `InlineClamp`
- describes the layout model rather than one scenario
- still works when only one visible row remains, because that is still a wrapped-item layout model

## Scenario boundary

Recommended v1 scope:

- arrays of atomic items
- wrapping across multiple rows
- clamp by `maxLines` and/or `maxHeight`
- optional expanded/collapsed state
- optional leading and trailing adornments
- optional trailing hidden-items summary such as `+3`
- browser-driven measurement

Explicitly out of scope for v1:

- partial item clipping
- splitting inside an item
- mixing free text and items in one clamp surface
- grids, masonry, and multi-column layouts
- keep-first-and-last policies
- overflow menus
- layout virtualization

## Render strategy tradeoffs

### Option A: user renders all children

Example:

```vue
<WrapClamp :max-lines="2">
  <Tag v-for="tag in tags" :key="tag">{{ tag }}</Tag>
</WrapClamp>
```

Advantages:

- natural composition
- easy migration from existing markup
- supports arbitrary item components

Costs:

- the runtime must infer item boundaries from arbitrary VNodes
- fragments, conditionals, stray text nodes, and comments complicate semantics
- hidden item data becomes awkward to expose
- overflow-summary logic becomes harder to define

### Option B: component owns `items`, user renders each item

Example:

```vue
<WrapClamp :items="tags" :max-lines="2">
  <template #item="{ item }">
    <Tag>{{ item }}</Tag>
  </template>
</WrapClamp>
```

Advantages:

- explicit item boundaries
- stable identity model
- easier hidden-count and hidden-items slot props
- simpler runtime and test matrix

Costs:

- heavier than direct child composition
- requires an `items` source even when markup already exists

### Option C: support both

Advantages:

- maximum ergonomic coverage

Costs:

- doubles the API surface
- doubles the docs burden
- introduces precedence and edge-case ambiguity

### Recommendation

Start with Option B only:

- `items` as source of truth
- `#item` slot for per-item rendering

This keeps the contract explicit and avoids vnode introspection in v1.

## Overflow summary and trailing slot semantics

Initial thought:

- use a dedicated `rest` slot because the trailing node stands in for hidden items

Counterargument from discussion:

- users own the UI just like they do in `LineClamp`
- the trailing node width affecting cutoff is not unique; `LineClamp.after` also affects layout
- users could summarize hidden text metadata in `LineClamp.after` as well if we exposed it
- introducing `before` + `rest` would create an awkward asymmetry if we later want a leading slot

Revised recommendation:

- keep `before` / `after` for `WrapClamp`
- expose hidden-item metadata through slot props
- document `after` as the recommended place for `+N`, `More`, or `Less` UI

This gives better family consistency:

- `LineClamp`: `before`, `after`
- `WrapClamp`: `item`, `before`, `after`

## Proposed `WrapClamp` slot model

- `item="{ item, index }"`
- `before="{ clamped, expanded, visibleCount, hiddenCount, hiddenItems, expand, collapse, toggle }"`
- `after="{ clamped, expanded, visibleCount, hiddenCount, hiddenItems, expand, collapse, toggle }"`

Notes:

- `before` and `after` should participate in measurement while collapsed
- `after` is the recommended place for hidden-summary UI, but not the only allowed use
- users own the actual button or badge content

## Recommended public surface

```ts
type WrapClampItemKey<T> = keyof T | ((item: T, index: number) => string | number);

interface WrapClampProps<T> {
  items: readonly T[];
  as?: string;
  maxLines?: number;
  maxHeight?: number | string;
  expanded?: boolean;
  itemKey?: WrapClampItemKey<T>;
}
```

Recommended events:

- `update:expanded`
- `clampchange`

Recommended exposed methods:

- `expand()`
- `collapse()`
- `toggle()`

## Overflow detection model

Preferred model:

- render items as actual DOM boxes
- treat each item as atomic
- detect the last fully visible item by row index and bottom edge
- hide all later items

The component should stay browser-driven, like `LineClamp`.

## Handling the summary item width

The hard case is the trailing `after` summary, for example `+3`, `+10`, or a custom button, because its own width changes the answer.

Reference article takeaway:

- precomputing every possible rest width is theoretically possible but too complex for this package
- rendering many possible summary nodes up front is also too heavy
- the practical approach is to let the browser settle with a small iterative loop

Recommended strategy:

1. measure collapsed fit without trailing summary
2. if items are hidden and an `after` summary exists, render it
3. remeasure
4. back off visible items until the summary also fits

Why this is acceptable:

- the component is already browser-truth-first
- the iteration count stays small in realistic badge lists
- it keeps the runtime readable

Do not start with:

- speculative 2N summary rendering
- aggressive width caches keyed by hidden count

Those optimizations should only be considered after profiling.

## RTL model

Recommended behavior:

- inherit `dir` / `direction` from the host container
- keep item order logical in the DOM
- do not reverse the source array for RTL
- let the browser place `before`, visible items, and `after` in logical inline order
- compute overflow using block-axis position (`offsetTop`, bottom edge), not left/right assumptions

Implications:

- in LTR, `after` will appear visually on the right
- in RTL, `after` will appear visually on the left
- slot naming should stay logical, not physical

## Relationship to `LineClamp`

Important conclusion from the discussion:

- users owning the expansion UI in `WrapClamp` does **not** force a redesign of `LineClamp`
- `LineClamp.before` / `after` still make sense as positional adornment slots around one text flow
- the stronger consistency win is sharing `before` / `after` naming in `WrapClamp`, not renaming `LineClamp`

## Current recommendation summary

- add a dedicated `WrapClamp` component
- keep it data-driven with `items`
- use `item`, `before`, and `after` slots
- recommend `after` for `+N` / `More` / `Less`
- expose hidden-item metadata through slot props
- stay browser-driven and keep the summary-width handling iterative rather than cache-heavy

## Open questions

- Should `before` and `after` be measured in both expanded and collapsed states, or only collapsed?
- Should the component ship a default `after` summary like `+N` when no slot is provided?
- Should `hiddenItems` be full item values, or should we keep the slot props smaller and expose only `hiddenCount` in v1?
- Should `itemKey` accept only a function, or also a property key shorthand?
