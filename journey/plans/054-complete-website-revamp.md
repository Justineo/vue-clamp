# Complete Website Revamp

## Goal

Discard the previous website directions and rebuild the demo and benchmark pages around a stricter minimal product language that uses space more intelligently on desktop while remaining calm, clear, and compact on mobile.

## Visual Thesis

Quiet precision: near-monochrome surfaces, restrained blue accents, compact typography, thin dividers, and one strong text-and-stage composition per section instead of cards.

## Content Plan

- Hero: product name, short technical promise, one measured live specimen, direct actions
- Support: one compact proof rail that explains what the component covers without marketing filler
- Detail: four interactive demo rows that prioritize the working surface, controls, and measured container
- Final CTA: usage/API as plain documentation columns, benchmark page as a dense scenario matrix with a lean status rail

## Interaction Thesis

- Use section rhythm and spacing rather than panel chrome to create hierarchy
- Keep measured container framing visible in both demo and benchmark previews so width constraints read immediately
- Limit motion to small button and disclosure transitions that sharpen affordance without adding personality noise

## Visual Language References

- [Linear](https://linear.app/)
- [Vercel](https://vercel.com/)
- [Notion](https://www.notion.com/)
- [Raycast](https://www.raycast.com/)

Shared traits to absorb as an inference:

- strong but compact type hierarchy
- few colors
- plain layout before card treatment
- tight utility copy
- crisp dividers and controlled whitespace

## Scope

- `packages/website/src/App.vue`
- `packages/website/src/BenchmarkPage.vue`
- `packages/website/src/style.css`
- `packages/website/src/BenchmarkScenarioPreview.vue`
- `packages/website/src/BenchmarkActualScenarioPreview.vue`
- `packages/website/src/BenchmarkComparatorPreview.vue`
- `journey/design.md`

## Plan

1. Reduce the demo page to a denser poster-like hero, one proof rail, and four utility-first demo rows.
2. Remove remaining oversized typography, large radii, decorative surfaces, and redundant supporting copy from the global website system.
3. Rebuild the benchmark page as a compact operational view with a thin intro rail, denser table framing, and quieter expanded previews.
4. Tune responsive behavior so desktop uses horizontal space efficiently while mobile collapses into clean stacked flows without oversized gaps.
5. Run `vp check --fix`, `vp test`, `vp run test:browser`, and `vp run build -r`, then update journey memory with the final direction.
