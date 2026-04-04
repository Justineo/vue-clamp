# WrapClamp API design

## Goal

Define a third clamp surface for wrapped atomic items such as badges, tags, pills, or chips, without overloading `LineClamp` or turning the package into a generic layout system.

## Naming

- Recommended public name: `WrapClamp`
- Reason:
  - aligns with `LineClamp` and `InlineClamp`
  - describes the layout model rather than one scenario
  - still fits the `maxLines="1"` case because one row is a degenerate wrapped layout, not a different primitive

## Core model

- `LineClamp`: clamp within text
- `InlineClamp`: clamp one text line with fixed edges
- `WrapClamp`: clamp wrapped atomic items by visible rows or visible height

The unit of preservation is the item, not graphemes or inline substrings.

## Complexity boundary

Support in v1:

- arrays of atomic items
- multiline wrapping
- `maxLines` and `maxHeight`
- optional `expanded`
- optional overflow affordance such as `+3`
- browser-driven measurement
- variable item widths

Do not support in v1:

- partial item visibility
- splitting inside an item
- mixed free text and items in one clamp surface
- grids, masonry, or multi-column semantics
- overflow menus or custom placement policies
- keeping first `n` and last `m` items simultaneously
- hybrid slot-children and data-driven rendering in one component

## Render strategy options

### Option A: user renders the whole list as children

Example:

```vue
<WrapClamp :max-lines="2">
  <Tag v-for="tag in tags" :key="tag">{{ tag }}</Tag>
  <template #overflow="{ hiddenCount }">+{{ hiddenCount }}</template>
</WrapClamp>
```

Pros:

- natural Vue composition
- easy migration from an existing `v-for`
- works with arbitrary item components

Cons:

- hard to define what counts as one item when default slot output includes fragments, text, or conditionals
- harder to preserve stable identity and expose hidden item data
- forces the runtime to introspect arbitrary VNodes
- makes the public contract harder to explain precisely

### Option B: component renders the list from `items`

Example:

```vue
<WrapClamp :items="tags" :max-lines="2">
  <template #item="{ item }">
    <Tag>{{ item }}</Tag>
  </template>

  <template #overflow="{ hiddenCount }">
    <Tag>+{{ hiddenCount }}</Tag>
  </template>
</WrapClamp>
```

Pros:

- explicit item boundaries
- stable identity is easy to model
- hidden count and hidden item slices are straightforward
- runtime stays browser-driven without VNode-tree heuristics
- documentation and tests stay simpler

Cons:

- heavier than direct children for small cases
- callers must adapt existing markup to `items` plus `#item`
- less suitable when the source is not naturally array-shaped

### Option C: support both

Pros:

- maximum ergonomics

Cons:

- largest API surface
- duplicate behavior paths and docs
- unclear precedence and harder edge-case rules

## Recommendation

Ship Option B first:

- `items` prop as the source of truth
- `#item` slot for rendering each visible item
- `#overflow` slot for the optional overflow affordance

Do not support arbitrary child rendering in v1. If real demand appears later, add it as a separate compatibility layer or wrapper after the item-driven model has proven stable.

## Suggested public surface

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

Recommended slots:

- `item="{ item, index }"`
- `rest="{ hiddenCount, hiddenItems, visibleCount, expanded, clamped, expand, collapse, toggle }"`

Recommended exposed methods:

- `expand()`
- `collapse()`
- `toggle()`

## Why this surface

- `expanded` and `clampchange` align with `LineClamp`
- `#rest` is clearer than `#overflow` because it explicitly means "the summarized remainder of hidden items"
- `hiddenItems` only makes sense when the component owns the source array
- `itemKey` keeps DOM identity explicit for measurement and patch stability

## Why not `before` / `after`

- In `LineClamp`, `before` and `after` are always-visible adornments around one text flow.
- In wrapped-item clamping, the special trailing element is different:
  - it only appears when items are hidden
  - its content usually depends on `hiddenCount`
  - its width changes the cutoff result and may force visible items to back off
- Because of that, generic `before` / `after` names blur two different concepts:
  - always-visible fixed content
  - clamp-owned hidden-items summary

Recommendation:

- do not expose `before` / `after` in v1
- expose `#rest` as the dedicated collapsed-summary slot
- if users need fixed content around the wrapped list, compose it outside `WrapClamp`

## `rest` semantics

- rendered only when `clamped && !expanded`
- participates in measurement as one atomic item inside the same wrap flow
- represents the hidden tail of the list
- receives:
  - `hiddenCount`
  - `hiddenItems`
  - `visibleCount`
  - `expanded`
  - `clamped`
  - `expand`, `collapse`, `toggle`
- if the slot is omitted, the default rendering should be a minimal `+N`

## RTL model

- rely on inherited browser `direction` / `dir`
- keep item order logical in the DOM; do not reverse the array for RTL
- append `rest` after the visible items in DOM order
- in RTL, that naturally places it at logical inline-end, which is visually on the left
- row detection should use block-axis position (`offsetTop` / top-bottom rects), not left/right assumptions
- any future side concepts should be logical (`start` / `end`), never physical (`left` / `right`)

## Measurement model

- render items as actual DOM elements in order
- treat each item as atomic
- determine the last fully visible item by row and bottom edge
- if an overflow slot exists, reserve space for it and back up until it fits
- hide all later items

This stays consistent with the package’s broader design: browser truth first, narrow semantics, readable runtime.
