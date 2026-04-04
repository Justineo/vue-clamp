# WrapClamp cache-backed recompute

## Goal

Deliver a simpler `WrapClamp` recompute model that stays browser-aligned, avoids unconditional full-list probes, and uses cached intrinsic item widths only to decide whether growth is worth probing.

## Direction

- Keep live DOM measurement as the source of truth for overflow.
- Start each collapsed recompute from the current rendered prefix instead of resetting to the full list.
- Keep a small width cache from already rendered item shells and use it only as a growth hint.
- Avoid speculative reactive commits when the cache says no growth is plausible.
- Preserve multiline correctness; only narrow growth probing where the cache meaningfully helps.
- Prefer explicit, linear control flow over layered guards and helper indirection.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- `vp run test:browser`
