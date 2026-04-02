# 064 DOM Default + Pure Pretext Fast Direction

## Goal

Refine the dual-engine direction with two stronger decisions:

1. Keep the default `vue-clamp` entry browser-aligned and DOM-based, matching the historical Vue 2 behavior before the new major release ships.
2. Make `vue-clamp/fast` a genuinely pure Pretext-driven engine, not merely the current hybrid implementation without the final browser-reconciliation step.

## Direction

- `vue-clamp`
  - compatibility- and fidelity-oriented
  - browser layout is the source of truth
  - preferred when CSS/browser behavior must be honored closely

- `vue-clamp/fast`
  - performance-oriented
  - Pretext owns line layout and candidate selection for plain text
  - DOM remains only for runtime facts that Pretext cannot infer directly, such as measured width, computed font inputs, line height, and side-slot widths

## Open Work

1. Define a shared component shell so both engines preserve the same Vue contract.
2. Promote the optimized DOM path from benchmark helper to production engine.
3. Define the exact documented limits of the pure Pretext variant.
