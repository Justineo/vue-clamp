# 092 Single-Line Native Fast Path

## Summary

- Committed the current simplification snapshot on `main` before starting the next line of work.
- Framed the native-overflow idea as a narrow enhancement, not a new default clamp engine.
- The next implementation should keep a single recompute flow and add a guarded native branch only for the collapsed one-line end-ellipsis case.
- Implemented the first rollout as an even narrower path:
  - collapsed
  - `maxLines === 1`
  - `location === "end"`
  - no `maxHeight`
  - default `…` ellipsis
- slot-aware one-line flex row with fixed-width `before` / `after` items and a flexible text cell
- Browser coverage now distinguishes native visual clipping from JS-trimmed fallback behavior.
- Accessibility support was redesigned so generic spans are no longer named with `aria-label`; the fallback path now exposes the full source text through a hidden sibling instead.

## Notes

- The biggest design risk is not clamp detection; it is preserving slot visibility and keeping the component contract understandable when native overflow is visual-only.
- The first implementation should stay conservative on eligibility and expand only if tests show the hybrid model is stable.
