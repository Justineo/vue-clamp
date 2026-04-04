# Styling hooks proposal

## Goal

Define one stable styling-hook API for `LineClamp`, `InlineClamp`, and `WrapClamp` so users can target meaningful internal parts without relying on brittle DOM structure selectors.

This proposal is intentionally about selectors, not themed variants or part-prop APIs.

## Proposed API

### 1. Add anatomy attributes to all stable internal wrappers

Every stable internal part should receive:

- `data-scope="<component-name>"`
- `data-part="<part-name>"`

Component scopes:

- `line-clamp`
- `inline-clamp`
- `wrap-clamp`

### 2. Expose meaningful state on the root

Use boolean presence attributes for orthogonal state.

`LineClamp` root:

- `data-clamped`
- `data-expanded`
- `data-native`

`InlineClamp` root:

- no required state in v1
- optional `data-split` if we think semantic split mode matters for styling

`WrapClamp` root:

- `data-clamped`
- `data-expanded`

### 3. Stable part map

#### `LineClamp`

- `root`
- `content`
- `before`
- `body`
- `after`

#### `InlineClamp`

- `root`
- `start`
- `body`
- `end`

#### `WrapClamp`

- `root`
- `content`
- `before`
- `item`
- `after`

## Concrete DOM direction

### `LineClamp`

Current render should gain:

- root element: `data-scope="line-clamp" data-part="root"`
- content wrapper: `data-scope="line-clamp" data-part="content"`
- before slot wrapper: `data-scope="line-clamp" data-part="before"`
- text/body wrapper: `data-scope="line-clamp" data-part="body"`
- after slot wrapper: `data-scope="line-clamp" data-part="after"`

Keep the hidden full-text accessibility span unexposed.

### `InlineClamp`

Current render should gain:

- root: `data-scope="inline-clamp" data-part="root"`
- start: `data-scope="inline-clamp" data-part="start"`
- body: `data-scope="inline-clamp" data-part="body"`
- end: `data-scope="inline-clamp" data-part="end"`

Keep the existing ad-hoc `data-inline-*` attributes only during migration if needed.

### `WrapClamp`

Current render should gain:

- root: `data-scope="wrap-clamp" data-part="root"`
- content: `data-scope="wrap-clamp" data-part="content"`
- before: `data-scope="wrap-clamp" data-part="before"`
- item: `data-scope="wrap-clamp" data-part="item"`
- after: `data-scope="wrap-clamp" data-part="after"`

Keep the existing `data-wrap-*` hooks temporarily if we want a non-breaking transition.

## Why this is the right level

### What we should support

- locating semantically meaningful internal wrappers
- targeting stateful root variants
- styling with plain CSS, CSS modules, CSS-in-JS, or utility selectors

### What we should not support yet

- per-part class props
- per-part style props
- root-to-part CSS variable matrix
- exposing every hidden or measurement-only implementation node

Those would all enlarge the API without first proving that the anatomy-hook model is insufficient.

## Documentation changes

If we implement this, update:

- README component docs
- website demo selectors
- website API notes

Add a small anatomy table for each component:

- part name
- meaning
- stable or internal-only

Also add one short rule:

- DOM nesting is not public API
- `data-scope`, `data-part`, and documented state attributes are

## Testing changes

Add browser or render tests that assert:

- each component root has the expected `data-scope` and `data-part="root"`
- each documented part exists when rendered
- root state attributes appear and disappear correctly
- old ad-hoc hooks remain only if we choose a compatibility window

This turns the styling hooks into an explicit contract rather than incidental DOM.

## Migration strategy

### Option A: additive first

1. Add `data-scope` / `data-part` and root state attrs.
2. Leave current `data-inline-*` and `data-wrap-*` in place temporarily.
3. Migrate docs and website selectors.
4. Remove the old attributes in a later breaking cycle.

Pros:

- safest
- easier rollout

Cons:

- temporary DOM duplication

### Option B: immediate cleanup

1. Replace current ad-hoc hooks directly.
2. Update docs/tests/site in the same change.

Pros:

- cleaner immediately

Cons:

- silent break for anyone styling against current internals

Recommendation:

- choose Option A unless we are confident the current hooks are still effectively private

## Suggested implementation order

1. Add the new attributes to `LineClamp`, `InlineClamp`, and `WrapClamp`.
2. Add root state attrs for `LineClamp` and `WrapClamp`.
3. Update website selectors to use the new anatomy hooks.
4. Add tests covering the contract.
5. Decide whether to keep or remove the old ad-hoc hooks.

## Example selectors for docs

```css
[data-scope="line-clamp"][data-part="after"] {
  margin-inline-start: 0.5ch;
}

[data-scope="inline-clamp"][data-part="end"] {
  color: var(--file-extension-color);
}

[data-scope="wrap-clamp"][data-part="item"] {
  border-radius: 999px;
}

[data-scope="line-clamp"][data-part="root"][data-clamped] {
  --read-more-accent: var(--c-accent);
}
```

## Recommendation

Proceed with:

- `data-scope`
- `data-part`
- root-level boolean state attributes

Do not add a prop-driven styling API unless we later prove the anatomy hooks are not enough.
