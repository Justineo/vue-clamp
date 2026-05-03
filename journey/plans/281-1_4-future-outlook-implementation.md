# 1.4 future outlook implementation

## Scope

Implement the 1.4+ future-outlook items that can land without broad public API expansion:

- Expand internal `LineClamp` native modes from single-line text overflow to conservative multiline `line-clamp`.
- Reduce text measured-path overhead without changing clamp behavior.
- Add development diagnostics for `RichLineClamp`; keep preparation ownership simple unless a
  repeated-source improvement is proven in real component workloads.
- Preserve `WrapClamp` grow correctness with exact DOM measurement and `hiddenItems`; defer
  capacity hints and slice memoization unless statistics show a meaningful user-visible win.

The following outlook items are explicitly non-goals for this pass:

- No public `strategy` prop.
- No Pretext subpath or package. The outlook frames this as 1.5+ exploration that needs accuracy data first.
- No default approximate SSR native fallback.
- No inline pre-hydration exact clamping runtime.

SSR skeleton is conditional in this pass. If the existing library structure offers a clean DOM/CSS hook without introducing a new required stylesheet or changing the public API contract, implement it. If not, record the blocker in `journey/design.md` and keep the exact native SSR subset covered by tests.

## Serial work

1. Branch, install, and baseline context.
2. Write this plan and keep `journey/logs/281-1_4-future-outlook-implementation.md` updated for non-trivial decisions.
3. Establish shared contracts first:
   - internal native mode type and detection rules
   - lower-allocation layout fit helper
   - text search final-apply behavior
4. Integrate subagent changes and resolve cross-file consistency.
5. Run at least three simplification/review passes:
   - implementation correctness pass
   - abstraction/API-surface pass
   - engineering simplification/perf pass
6. Run `vp check` and `vp test`; run browser contract subsets that cover touched behavior.

## Parallel work

These can proceed independently after the shared contracts are understood:

- `LineClamp` and text hot path:
  - Native mode split: `"single-line"` / `"multi-line"` / `null`.
  - Multiline native only for exact end/grapheme/default ellipsis/no maxHeight/no after/supported browser.
  - Tests for before allowed, after excluded, and clamped-state detection.
- Rich path:
  - Development-only diagnostics for unsupported rich layout fallback.
  - Keep rich preparation uncached in this pass until repeated-source ownership and eviction have a
    clear component-level payoff.
  - Browser contract cases for repeated identical HTML and unsupported fallback diagnostics.
- Wrap path:
  - Keep the simple shrink-then-linear-grow live DOM loop.
  - Preserve `hiddenItems` without adding slice memoization until allocation-sensitive evidence
    shows it matters.
  - Browser contract cases for large lists and after digit-width boundaries.

## Verification

- `vp check`
- `vp test`
- targeted browser tests for clamp/rich/wrap/inline where changed behavior is covered
