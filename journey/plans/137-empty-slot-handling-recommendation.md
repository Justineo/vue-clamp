# Empty slot handling recommendation

## Decision

Do not use CSS `:empty` as the primary fix.

Do not make slot-VNode inspection the preferred long-term strategy either, because it deepens our reliance on the exact VDOM slot invocation path that Vue currently flags as a Vapor interop rough edge.

## Recommended approach

Use DOM-based effective-content detection for `before` / `after` wrappers.

## Why

- Better than CSS `:empty`:
  - handles more cases
  - is not broken by whitespace text nodes
  - reflects what is actually rendered

- Safer than slot-VNode inspection:
  - less coupled to VDOM internals
  - avoids leaning harder on `slots.before?.()` / `slots.after?.()` analysis logic
  - more future-friendly while Vapor interop is still unstable

## Proposed rule for “meaningful content”

A wrapper counts as non-empty if any of these are true:

- it contains a child element
- it contains non-whitespace text

That covers:

- icon-only buttons
- badges with nested spans
- plain text labels

## Implementation shape

Potential shape:

1. Keep the wrapper ref.
2. After render / on resize / on slot updates, compute:
   - `hasBeforeContent`
   - `hasAfterContent`
3. Use those flags to:
   - skip measurement when empty
   - optionally omit rendering on the next pass, or apply `display:none`

## Note

This does not solve the broader Vapor interop question for VDOM render-function components. It only avoids making that dependency even stronger by adding VNode-content inspection as a core behavior.
