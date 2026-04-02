# Custom Website Structure Reset

## Goal

Replace the current website with a fully custom, compact documentation-style interface that removes Spectre.css, abandons the stacked showcase layout, and reorganizes the demo around one primary interactive workspace.

## Visual Thesis

Technical notebook: crisp sans typography, calm grayscale surfaces, one electric blue accent, monospaced utility details, and dense but breathable spacing.

## Content Plan

- Intro: product name, terse description, install command, direct links
- Playground: one active scenario workspace with scenario switching, horizontal controls, and one measured render stage
- Reference: usage snippet and API reference in full-width technical blocks
- Benchmark: compact operator header, run controls, summary line, full-width scenario matrix

## Interaction Thesis

- Scenario switching changes one shared workspace instead of repeating four long sections
- Controls stay close to the measured stage so cause and effect read immediately
- Benchmark disclosures stay inline and compact; motion is limited to tabs, buttons, and disclosure arrows

## Visual Language References

- [React](https://react.dev/)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs/)
- [Linear](https://linear.app/homepage)

Shared traits to absorb as an inference:

- documentation-first hierarchy
- strong typography without oversized hero theatrics
- compact operational copy
- wide working surfaces instead of narrow stacked columns
- custom minimal primitives rather than framework-looking UI kits

## Scope

- `packages/website/src/App.vue`
- `packages/website/src/BenchmarkPage.vue`
- `packages/website/src/DemoControls.vue`
- `packages/website/src/BenchmarkScenarioPreview.vue`
- `packages/website/src/BenchmarkActualScenarioPreview.vue`
- `packages/website/src/BenchmarkComparatorPreview.vue`
- `packages/website/src/style.css`
- `packages/website/package.json`
- `journey/design.md`

## Plan

1. Remove Spectre-specific dependency and markup assumptions from the website package.
2. Rebuild the demo page around one wide playground with scenario tabs, compact controls, and one dominant measured stage.
3. Replace the current documentation layout with full-width technical reference blocks instead of narrow columns.
4. Restructure the benchmark page into a compact operator view that keeps the table central and the disclosure previews quiet.
5. Run `vp check --fix`, `vp test`, `vp run test:browser`, and `vp run build -r`, then update journey memory with the new structural direction.
