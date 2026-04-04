# Slot vnode inspection and Vapor research

## Question

Should we inspect slot-returned VNodes to avoid rendering empty `before` / `after` wrappers? Is that a better solution than CSS like:

```css
[data-part="after"]:empty {
  display: none;
}
```

And would vnode inspection be compatible with Vue Vapor mode?

## Current local context

`LineClamp` and `WrapClamp` currently do:

- `const beforeSlot = slots.before?.(slotProps)`
- `const afterSlot = slots.after?.(slotProps)`
- render the wrapper if the slot return value is truthy

That means:

- `[]` is treated as present content
- comment-only / empty-fragment slot output can still produce an empty wrapper
- the wrapper may remain in DOM even when there is no meaningful visible content

## What the official Vue docs say

### Render functions normally access slots as VNode arrays

The official Vue render-function guide explicitly says that in render functions, slot functions on `slots` return arrays of VNodes and can be invoked directly:

- [Vue render functions guide](https://vuejs.org/guide/extras/render-function)

Relevant section:

- `slots.default()` / `slots.footer({ ... })` are shown as the normal VDOM render-function pattern.

So in plain VDOM mode, inspecting returned slot VNodes is technically aligned with Vue’s model.

### Vue’s own internal helper for `<slot/>` validates slot VNodes

Vue runtime-core has an internal `renderSlot` helper that calls `ensureValidVNode(slot(props))`.

The helper treats slot content as empty when it only contains:

- `Comment`
- `Fragment` trees that recursively contain no valid children

Source:

- [Vue runtime-core `renderSlot` helper](https://coverage.vuejs.org/runtime-core/src/helpers/renderSlot.ts)

Important details from the source:

- `renderSlot` is marked `@private`
- `ensureValidVNode()` is not public API
- the helper exists specifically to normalize template `<slot/>` rendering behavior

So the concept of checking slot VNodes for “meaningful content” is real and already used by Vue itself, but the exact helper is internal.

## What the official Vapor guidance says

The Vue 3.6 beta release notes explicitly call out a current VDOM interop limitation:

- [Vue core release notes with Vapor mode notes](https://github.com/vuejs/core/releases)

The relevant note says:

- Vapor mode only works for SFCs using `<script setup vapor>`
- when Vapor and VDOM components are mixed through `vaporInteropPlugin`, rough edges remain for VDOM-based component libraries
- a known issue is that Vapor slots cannot be rendered with `slots.default()` inside a VDOM component; `renderSlot` must be used instead

This matters directly to our question because vnode inspection requires exactly this flow:

- invoke `slots.before?.(...)`
- receive VNodes
- inspect them

That means vnode inspection is not just “a bit VDOM-specific”. It sits directly on the current known Vapor interop rough edge.

## Conclusions

### 1. Is vnode inspection a better local solution than `:empty`?

For current VDOM correctness, yes.

Why it is better than CSS `:empty`:

- `:empty` is DOM-level and fragile
- whitespace text nodes break `:empty`
- a slot can produce empty arrays or comment-only output that `:empty` never sees correctly
- `:empty` is a visual patch, not a rendering decision

VNode inspection lets us make the right decision one level earlier:

- render no wrapper when the slot has no meaningful content

### 2. Is vnode inspection ideal if we care about Vapor compatibility?

No.

Reason:

- Vapor interop currently has a known issue specifically around calling `slots.default()` from VDOM components
- our clamp components are VDOM render-function components today
- inspecting returned slot VNodes increases our dependence on that exact slot-invocation path

So vnode inspection is good for VDOM mode, but not the best direction if we want to bias toward future Vapor compatibility.

### 3. Can we just use `renderSlot` instead?

Not comfortably as a public-library strategy.

Vue’s own `renderSlot` helper is internal / compiler-runtime-oriented:

- it is marked `@private` in runtime-core
- the official public render-function guide does not present it as normal library author API

So relying on `renderSlot` as our library contract would mean leaning on internals rather than documented public surface.

## Recommended direction

If the goal is:

- avoid empty wrappers
- keep the implementation future-leaning
- avoid relying on VNode introspection as a public design choice

then the better direction is:

### Prefer DOM-based empty detection over slot-VNode inspection

That means:

1. Render the wrapper when the slot exists.
2. After render, inspect the wrapper element itself.
3. Determine whether it has meaningful DOM content.
4. Hide or skip measuring the wrapper when it is effectively empty.

This is less elegant than perfect first-pass vnode filtering, but it is:

- more renderer-agnostic
- closer to what the browser actually sees
- less coupled to the current Vapor interop slot limitation

## Practical trade-off

### Option A: VNode inspection

Pros:

- cleanest rendered output
- no extra wrapper flash
- closest to Vue’s internal `ensureValidVNode()` idea

Cons:

- tied to VDOM slot invocation
- sits on a known Vapor interop rough edge
- would likely need our own copy/adaptation of internal logic

### Option B: CSS `:empty`

Pros:

- tiny
- no JS logic

Cons:

- fragile
- wrong abstraction layer
- will miss several “slot is empty” cases

### Option C: DOM-based effective-content detection

Pros:

- does not depend on slot VNode inspection
- closer to renderer truth
- more future-friendly for mixed runtime modes

Cons:

- slightly more stateful
- wrapper may exist for one pass before being hidden/skipped
- needs a clearly defined “meaningful content” rule

## Recommendation

If we only cared about today’s VDOM mode, I would choose vnode inspection.

But given the explicit Vapor interop note from Vue, I would not make vnode inspection our preferred long-term strategy.

Recommended order:

1. Do not rely on `:empty` as the main solution.
2. Do not build around slot-VNode inspection if Vapor compatibility matters.
3. Use DOM-based effective-content detection for `before` / `after` wrappers.

That gives us a more conservative, renderer-facing solution while Vapor mode is still evolving.
