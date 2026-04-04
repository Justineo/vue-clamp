# Empty slot vnode filtering

## Goal

Suppress empty `before` / `after` wrappers in `LineClamp` and `WrapClamp` by inspecting slot-returned VNode content before rendering the wrapper.

## Direction

- Ignore Vapor compatibility for this change.
- Prefer VNode-content filtering over CSS `:empty`.
- Use Vue public exports only:
  - `isVNode`
  - `Comment`
  - `Fragment`
  - `Text`

## Scope

- Add one small shared helper to detect meaningful slot content.
- Use it in:
  - `packages/vue-clamp/src/LineClamp.ts`
  - `packages/vue-clamp/src/WrapClamp.ts`
- Add browser regressions proving empty wrappers are not rendered.
- Update design memory and logs.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
