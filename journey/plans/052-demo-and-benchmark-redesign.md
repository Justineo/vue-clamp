# Demo And Benchmark Redesign

## Goal

Redesign the website demo and benchmark views so they feel intentional and current, while preserving the existing interactive scenarios and benchmark workflow.

## Visual Thesis

Build the site like a calm editorial lab sheet: warm paper surfaces, dark ink typography, a restrained amber accent, and framed measurement areas that make text layout feel tangible.

## Content Plan

- Hero: product name, concise promise, immediate paths to demo and benchmark
- Support: compact feature/value summary with install and usage context
- Detail: four interactive clamp cases presented as focused lab modules
- Final CTA: API surface and repository links without extra marketing chrome

## Interaction Thesis

- A poster-style hero with a static benchmark ribbon and a live clamp specimen as the visual anchor
- Demo controls and benchmark rows should feel like instrument panels, with deliberate framing instead of generic cards
- Preview areas should expose the actual container bounds with a visible stage/background so width changes read instantly

## Scope

- `packages/website/src/App.vue`
- `packages/website/src/BenchmarkPage.vue`
- `packages/website/src/DemoControls.vue`
- `packages/website/src/BenchmarkScenarioPreview.vue`
- `packages/website/src/BenchmarkActualScenarioPreview.vue`
- `packages/website/src/BenchmarkComparatorPreview.vue`
- `packages/website/src/benchmark/preview.ts`
- `packages/website/src/style.css`
- website/browser tests as needed
- `journey/design.md`

## Plan

1. Recompose the demo page into a stronger full-page sequence with a hero, compact proof/feature strip, and clearer interactive sections while keeping the existing examples and bilingual support.
2. Redesign the benchmark page around a clearer header, denser row hierarchy, and improved expanded-row previews that feel like part of the same visual system as the demo.
3. Make benchmark previews show the real container area explicitly by styling the render stage and the width-constrained container shells, for both the live Vue render and the comparator fixtures.
4. Update or add browser coverage only where the redesign affects behavior or the new visible container framing needs protection.
5. Run `vp check`, `vp test`, and `vp run test:browser`, then update `journey/design.md` and the matching log with the new website direction.
