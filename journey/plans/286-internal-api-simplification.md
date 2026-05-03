# Internal API simplification

## Goal

Reduce recently added internal module contracts without changing runtime behavior.

## Scope

- Move native CSS clamp decisions out of `text.ts` and back into `LineClamp.ts`.
- Shorten `rich.ts` exports where the module name already provides context.
- Replace wide positional rich clamp arguments with a single named input object.
- Replace the wide text DOM clamp argument list with a named input object.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
