# 089 Compact Website Reset

## Goal

Tear down the current website presentation and rebuild it from scratch as a compact, precisely aligned, minimalist demo/docs surface with a stronger VoidZero-adjacent design language.

## Visual Thesis

Instrument panel: crisp monochrome layout, disciplined column alignment, mono utility labels, one cold blue accent with a faint mint glow, and a few polished detail cues instead of broad decorative styling.

## Content Plan

- Header rail: product name, section jumps, language switch
- Hero/workspace: title, install command, and one dominant two-column demo area
- Reference: usage and API in a compact document grid

## Interaction Thesis

- Scenario switching should feel like changing a mode inside one instrument, not paging through mini-marketing sections
- The demo controls should live in a narrow aligned column beside the measured output
- Delight should come from subtle border reveals, a restrained glow plane, and small utility markers rather than large visual effects

## Visual Language References

- [VoidZero](https://voidzero.dev/)
- [Vite](https://vite.dev/)
- [Vitest](https://vitest.dev/)
- [Oxc](https://oxc.rs/)

Shared traits to absorb as an inference:

- tighter document rhythm
- stronger product mark and utility rails
- code/tooling-first cues
- compact composition with deliberate spacing
- limited but polished accent lighting

## Scope

- `packages/website/src/App.vue`
- `packages/website/src/style.css`
- `packages/website/src/DemoControls.vue`
- `journey/design.md`

## Plan

1. Replace the current masthead and stacked sections with a new page composition centered on one aligned workspace.
2. Restructure the demo controls so they feel like an inspector column, not a generic form block.
3. Rebuild the stylesheet from scratch around a stricter grid, flatter surfaces, and a few small premium details.
4. Validate with `vp check --fix`, `vp test`, `vp run test:browser`, and `vp run build -r`.
