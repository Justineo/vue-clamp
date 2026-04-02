# Simple DOM Default Rewrite

## Goal

Simplify the default DOM-based component toward a same-context live DOM search, removing the detached measurement clone and the derived line-based collapsed `max-height`, then validate whether the simpler design remains reliable.

## Scope

- `packages/vue-clamp/src/component.ts`
- `packages/vue-clamp/src/engine-dom.ts`
- `packages/vue-clamp/src/host.ts`
- `packages/vue-clamp/benchmark/dom/default.ts`
- relevant browser tests
- `journey/design.md`

## Steps

1. Replace detached-clone DOM search with same-context live search on the rendered component.
2. Remove the default component's derived line-based collapsed `max-height` path and the state that only existed to support it.
3. Add browser regressions for inherited same-context styling and post-resize line-limit stability.
4. Run `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.

## Status

- Completed on 2026-04-01.
- The detached clone was removed and the default DOM engine now searches in the live rendered DOM.
- The attempted removal of derived line-based collapsed clipping caused a new resize-time browser regression, so that guardrail was restored.
- Validation passed with `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
