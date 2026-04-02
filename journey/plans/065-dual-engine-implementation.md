# 065 Dual Engine Implementation

## Goal

Implement a dual-engine `vue-clamp` package with:

- `vue-clamp` as the browser-aligned DOM engine
- `vue-clamp/fast` as the pure Pretext engine

Both entries must preserve the same Vue component contract.

## Plan

1. Extract a shared component shell that owns the public Vue contract:
   - props
   - emits
   - slot collection/rendering
   - exposed methods
   - autoresize/font scheduling
   - initial hidden gating
   - shared root-style derivation
2. Implement a production DOM engine using hidden DOM measurement and binary search over visible text.
3. Implement a pure Pretext engine using the existing Pretext clamp core without browser-fit reconciliation.
4. Wire package exports and build outputs for both `vue-clamp` and `vue-clamp/fast`.
5. Expand tests to cover both entries and validate browser behavior for the new default.
6. Update website imports, docs text, and journey memory to reflect the new engine split.
