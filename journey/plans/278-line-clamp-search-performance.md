# LineClamp search performance

Date: 2026-04-30

## Goal

Improve `LineClamp` performance during continuous layout changes without delaying recompute or
allowing stale / unclamped output to paint.

## Constraints

- Do not defer clamp correctness with `requestAnimationFrame` throttling inside the library.
- Do not intentionally paint an unclamped source string or stale clamped string after layout has
  changed.
- Keep the optimization internal and reusable by text-based clamp surfaces.

## Approach

- Reduce each fit probe's layout processing overhead by avoiding array allocation and full line
  collection where early exit is enough.
- Add a generic warm-start search helper that can start near the previous kept count, expand to a
  bracketing interval, then binary-search that smaller interval.
- Reuse the last text-search result as the next warm-start hint. The shared search helper only
  accepts that hint when its prepared boundary offsets still match.

## Validation

- Add unit coverage for warm-start search behavior.
- Run `vp check`, `vp test`, and relevant browser tests.

## Status

Implemented on 2026-04-30.
