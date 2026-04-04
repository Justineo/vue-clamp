## Goal

Add `WrapClamp` to the docs site as a first-class component surface with realistic demos, an example snippet, and API notes that match the existing `LineClamp` / `InlineClamp` presentation.

## Constraints

- Keep the page simple and aligned with the current website information structure.
- Reuse the existing tabs, demo block rhythm, code block, and API table patterns.
- Avoid turning `WrapClamp` into a separate microsite inside the docs page.
- Focus on real use cases instead of synthetic prop showcases.

## Proposed surface

### Hero and features

- Update the hero tagline to mention `WrapClamp`.
- Add one `WrapClamp` bullet to the features section focused on wrapped chips, tags, filters, and selected-value lists.

### Component tabs

- Extend the component tabs from two surfaces to three:
  - `LineClamp`
  - `InlineClamp`
  - `WrapClamp`
- Add a concise tooltip description for `WrapClamp`.

### WrapClamp demo content

Use three demos that show distinct value without duplicating library contract tests:

1. Labels / max-lines / trailing summary
   - Responsive issue or release labels.
   - Controls: `maxLines`, `width`.
   - `after` renders `+N more`.

2. Invitees / max-height / before + after / expansion
   - Selected reviewers or guests in pill form.
   - Controls: `maxHeight`, `width`, `expanded`.
   - `before` renders a short prefix badge.
   - `after` renders `More` / `Less`.

3. Filters / RTL / logical inline-end
   - Arabic category chips with a summary chip.
   - Controls: `maxLines`, `width`, `RTL`.
   - Shows that item order stays logical and the trailing summary follows browser direction.

### Example section

- Add a `WrapClamp` example code block.
- Keep it practical and short:
  - `items`
  - `item-key`
  - `item` slot
  - `after` slot with `hiddenCount` and `toggle`

### API section

- Add a third API branch for `WrapClamp`.
- Include:
  - props table
  - slots table
  - events table
  - notes list
- Notes should emphasize:
  - whole-item clamping
  - `items` as the source of truth
  - `after` as the recommended place for `+N`, `More`, and `Less`
  - `before` / `after` affect measurement

### Browser coverage

- Extend the docs-page browser tests to recognize the third surface.
- Add focused assertions for:
  - the `WrapClamp` tab and tooltip
  - demo block presence and ordering
  - example copy button content
  - wrap API notes

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build -r`
