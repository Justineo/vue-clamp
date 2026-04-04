# LineClamp vs WrapClamp slot semantics

## Question

If `WrapClamp` lets users own the `More` / `Less` UI, should `LineClamp` and `WrapClamp` use the same slot naming model?

## Key distinction

User ownership of UI and slot semantics are different decisions.

- In both `LineClamp` and a future `WrapClamp`, users should own the actual expansion controls.
- That does **not** mean both components need identical slot names.

## `LineClamp`

`LineClamp` has one primary subject: a text flow.

Its current slots are positional adornments around that flow:

- `before`
- `after`

Those slots:

- can render conditionally
- can render a `More` / `Less` button
- can render arbitrary content unrelated to hidden text
- are still fundamentally "content placed before or after the text"

This makes `before` / `after` a good fit for `LineClamp`.

## `WrapClamp`

`WrapClamp` has a different primary subject: a visible prefix of atomic items plus a hidden remainder.

The trailing summary element is not merely "content after the items". It is:

- conditional on hidden items existing
- derived from hidden item state
- width-sensitive in the clamp calculation
- semantically a stand-in for hidden items

So even if users render the visual UI, the slot itself is still conceptually special.

## Recommendation

- Keep `LineClamp` as-is with `before` / `after`.
- Do **not** retrofit `LineClamp` around this new distinction.
- For `WrapClamp`, prefer a dedicated slot for the hidden remainder:
  - recommended name: `rest`

This is not inconsistency. It reflects two different component models:

- `LineClamp`: positional adornments around text
- `WrapClamp`: explicit hidden-remainder summary inside an item flow

## When to revisit `LineClamp`

Only revisit `LineClamp` if we want a broader major-version redesign of all clamp surfaces around semantic slots rather than positional ones.

That would be a real API rethink, not a local cleanup. Without that larger redesign, changing `LineClamp` would mostly add churn without improving clarity.
