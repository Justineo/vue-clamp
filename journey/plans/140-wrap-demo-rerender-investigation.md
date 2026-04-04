# Wrap demo rerender investigation

## Goal

Investigate why the website `WrapClamp` demos appear to rerender continuously and identify whether the churn comes from demo-level reactive state, component-level watchers, or observer-driven recomputes.

## Approach

- Inspect the website wrap-demo state and derived values in `packages/website/src/App.vue`.
- Inspect the `WrapClamp` runtime recompute flow in `packages/vue-clamp/src/WrapClamp.ts`.
- Add temporary instrumentation only if static review is insufficient.
- Confirm the root cause and recommend or implement the smallest fix consistent with current code style.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
