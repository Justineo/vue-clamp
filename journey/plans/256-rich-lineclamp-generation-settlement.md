# RichLineClamp generation-scoped image settlement

## Goals

- Replace the current ancestor-capture image invalidation patch with the generation-scoped
  settlement model from `journey/research/256-rich-line-clamp-vnext-design.md`.
- Keep the change local to `RichLineClamp` so the shared multiline shell remains simple and shared
  with `LineClamp`.
- Add browser coverage for the cases that motivated the redesign.

## Constraints

- Keep the rich clamp search in the connected DOM.
- Do not introduce a second probe tree or a separate rendering architecture.
- Prefer small local helpers over new shared abstractions unless they are clearly reusable.

## Plan

1. Replace the `watchPostEffect` ancestor listener in `packages/vue-clamp/src/RichLineClamp.ts`
   with recompute-generation image tracking:
   - clear the previous generation listeners after every recompute
   - scan the current connected images for layout-affecting unresolved nodes
   - trigger at most one follow-up recompute when the current generation settles
2. Add a provisional conceal/reveal state so unresolved current-generation rich images do not leave
   stale visible truncation on screen.
3. Cover the new behavior in `packages/vue-clamp/tests/clamp.browser.test.ts`, including:
   - detached stale image events are ignored after a same-html DOM replacement
   - current-generation image settlement reveals and reclamps
   - deterministic-size unresolved images do not block visibility
4. Update `journey/design.md` and the matching log entry if the implementation changes the
   canonical runtime description.
