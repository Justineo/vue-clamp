# Inline Toggle Width Regression Round Two

## Goal

Investigate the newly observed width-specific regression in the demo's inline-toggle example where nearby widths alternate between a plausible clamp and an implausibly short one.

## Scope

- `packages/website/src/App.vue`
- `packages/vue-clamp/src/component.ts`
- `packages/vue-clamp/src/dom-clamp.ts`
- Browser tests covering width sweeps and demo-page behavior

## Plan

1. Reproduce the reported widths (`327px`, `324px`, `323px`, `320px`) against the actual demo scenario.
2. Trace whether the bad output comes from Pretext clamp selection, DOM measurement inputs, or the overflow-correction fallback.
3. Implement the smallest fix that restores monotonic width behavior without weakening the inline-slot protection.
4. Add a regression test over the affected width window and rerun validation.
