# Wrap demo RTL merge

## Goal

Simplify the website `WrapClamp` demos by removing the dedicated RTL example and folding RTL behavior into the existing demos.

## Direction

- Keep the tabs demo.
- Keep the invitees demo.
- Remove the standalone filters/RTL demo.
- Add an `RTL` toggle to the tabs and invitees demos so they switch both direction and visible copy to Arabic.

## Implementation notes

- Tabs demo:
  - translate tab labels to Arabic
  - translate the overflow trigger aria-label to Arabic
- Invitees demo:
  - translate the `before` prefix and the `More` / `Less` labels
  - switch invitee labels to Arabic names
- Update browser tests to:
  - expect only two wrap examples
  - verify both demos switch to Arabic when `RTL` is enabled

## Validation

- `vp check --fix`
- `vp run test:browser`
