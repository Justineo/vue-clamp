# Benchmark Spectre Fonts And Clean Bars

## Goal

Bring the benchmark page back closer to the Spectre-based site style, restore compact bar charts, and keep the report minimal and ratio-first.

## Scope

- `apps/website/src/BenchmarkPage.vue`
- `apps/website/src/style.css`
- `journey/design.md`
- `journey/logs/019-benchmark-spectre-fonts-and-clean-bars.md`

## Requirements

- Follow Spectre typography more closely.
- Remove the benchmark page's custom display-font direction.
- Keep visible metrics ratio-first against Legacy DOM.
- Keep raw `ops/s` in tooltips only.
- Restore compact charts in a clean, unobtrusive form.
- Use softer, friendlier chart colors.
- Stay dense and avoid returning to a dashboard-like layout.

## Plan

1. Rework the page model for compact chart cells.
   - Keep the summary table.
   - Add one small chart column to the scenario table.
   - Normalize bars within each scenario row.
   - Keep exact ratios in dedicated columns.

2. Revert typography toward Spectre defaults.
   - Remove custom benchmark font-family choices.
   - Reduce font customizations to only what helps scan speed.
   - Keep sizes small and consistent with the demo site.

3. Tidy the chart styling.
   - Use slim tracks and fills.
   - Use shorter labels.
   - Keep color restrained and readable.
   - Put ratio and `ops/s` details in tooltips where useful.

4. Validate.
   - Run `vp fmt`.
   - Run `vp check`.
   - Run `vp run build -r`.
   - Do a browser sanity check on the benchmark route.

## Acceptance Criteria

- The page feels visually aligned with the main Spectre demo site.
- Bars are back, but remain compact and secondary to the numeric ratios.
- Custom benchmark typography no longer dominates the page.
- The page stays minimal and high-density.
