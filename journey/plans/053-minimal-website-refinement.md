# Minimal Website Refinement

## Goal

Replace the previous heavy visual treatment with a minimal, more aesthetic presentation for the demo and benchmark pages while preserving the current information architecture and interactive behavior.

## Visual Thesis

Calm editorial product UI: off-white canvas, charcoal typography, one restrained blue accent, fine rules, modest radii, and almost no depth.

## Content Plan

- Hero: product name, short promise, immediate actions, one quiet live specimen
- Support: concise proof strip and four focused interactive demo cases
- Detail: benchmark header reduced to utility context plus the scenario matrix
- Final CTA: usage/API remain, but as light documentation blocks instead of decorated panels

## Interaction Thesis

- Very small hover lift only on primary actions
- Subtle section rhythm through rules and spacing rather than panels
- The measured container remains visible in benchmark previews, but via quiet stage framing instead of themed cards

## Scope

- `packages/website/src/App.vue`
- `packages/website/src/BenchmarkPage.vue`
- `packages/website/src/style.css`
- benchmark preview SFC styles as needed
- `journey/design.md`

## Plan

1. Reduce the demo hero and content layout to a quieter composition with better type hierarchy.
2. Flatten the benchmark top section into a minimal utility header instead of large summary panels.
3. Replace the current gold-heavy surface system with neutral surfaces, subtle accenting, smaller radii, and lighter or removed shadows.
4. Keep the benchmark measured-container visibility, but restyle the preview stage so it reads as precise instrumentation instead of decoration.
5. Run `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`, then document the new direction in `journey/design.md` and the matching log.
