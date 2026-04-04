## Goal

Refine the new `WrapClamp` website demos and supporting runtime details to better match the intended component model.

## Requested changes

1. `data-wrap-content` should lay out as `inline-flex` with `flex-wrap: wrap`.
2. Demo spacing should not depend on margins applied directly to user-provided rendered items.
3. Remove the `--guide-shadow-x` / `--guide-shadow-y` box-shadow indirection from the docs demo surface.
4. Replace the first wrap demo with a one-line tabs overflow case that collects hidden items into the `after` slot via a dropdown trigger with an ellipsis icon.
5. Make the RTL wrap demo behave like the `LineClamp` demos by toggling between English and Arabic content instead of always rendering Arabic.

## Approach

### Runtime

- Add an explicit style object for `data-wrap-content` in `packages/vue-clamp/src/wrap.ts`.
- Keep spacing out of the core component. The runtime should define flow behavior, not item margins.

### Website demos

- Replace the current labels summary demo with a realistic tabs toolbar demo.
- Keep two other demos:
  - invitees / max-height / before + after / expansion
  - filters / RTL toggle / translated content
- Move visual spacing to the demo-level `data-wrap-content` container using flex `gap`.
- Introduce lightweight tab/dropdown demo chrome with Lucide icons.

### Styling cleanup

- Remove the custom guide-shadow CSS variable approach from `.demo-output`.
- Use direct border treatment on `.width-guide` and `.height-guide`.

### Browser coverage

- Update the docs-page browser test for:
  - tabs demo labels and overflow trigger
  - wrap RTL toggle switching to Arabic
  - existing wrap example copy/API assertions

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
- `vp run build -r`
