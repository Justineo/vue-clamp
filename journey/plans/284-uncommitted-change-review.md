# Uncommitted change review

## Goal

Review every uncommitted addition from the current branch and reduce it to the smallest implementation that still serves the 1.4 goals.

## Review questions

- Is this required for the current product/runtime goal?
- Is the implementation already the simplest reasonable version?
- Is there over-design, over-abstraction, or duplicated responsibility?
- Can it be deleted, simplified, or reused from an existing module?

## Scope

- Library runtime changes in `packages/vue-clamp/src`.
- Browser and unit tests in `packages/vue-clamp/tests`.
- Website demo, stress playground, overlay scrollbar, and FPS meter changes.
- Journey plans, logs, research, and design updates.

## Validation

- Run `vp check`.
- Run `vp test`.
- Run `vp run test:browser`.
- Run `vp run build`.
