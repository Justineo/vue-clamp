# Data-part styling hooks implementation

## Goal

Refactor the clamp surfaces to use one unified anatomy hook:

- `data-part="<part>"`

Do not add:

- `data-scope`
- root state attrs like `data-clamped` or `data-expanded`
- compatibility aliases for the old `data-inline-*` and `data-wrap-*` hooks

This is an unreleased API, so we can move directly to the cleaner contract.

## Scope

### `LineClamp`

Add stable `data-part` markers for:

- `root`
- `content`
- `before`
- `body`
- `after`

Do not expose the hidden accessibility source node.

### `InlineClamp`

Replace:

- `data-inline-start`
- `data-inline-body`
- `data-inline-end`

with:

- `data-part="root"`
- `data-part="start"`
- `data-part="body"`
- `data-part="end"`

### `WrapClamp`

Replace:

- `data-wrap-content`
- `data-wrap-before`
- `data-wrap-item`
- `data-wrap-after`

with:

- `data-part="root"`
- `data-part="content"`
- `data-part="before"`
- `data-part="item"`
- `data-part="after"`

## Follow-up updates

Update all internal consumers:

- website demo CSS selectors
- browser tests
- README and design memory

Document the rule clearly:

- `data-part` values are the stable styling contract
- DOM nesting is not

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
