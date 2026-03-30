# Benchmark Rounded Tables And Row Details

## Goal

Add subtle Spectre-like table rounding and make scenario rows expandable so the detailed setup for each benchmark case can be read on demand.

## Scope

- `apps/website/src/BenchmarkPage.vue`
- `apps/website/src/style.css`
- `journey/design.md`
- `journey/logs/020-benchmark-rounded-tables-and-row-details.md`

## Requirements

- Add a small border radius to benchmark table wrappers.
- Keep the benchmark page dense by default.
- Make scenario rows expandable.
- Show a readable scenario description only when a row is expanded.
- Avoid bloating the benchmark report shape unless it is necessary.
- Keep the visible summary and ratio columns unchanged.

## Plan

1. Add a lightweight scenario-detail model in the page.
   - Derive detail text from the existing scenario metadata already present in the report.
   - Avoid reintroducing large benchmark-report payloads.

2. Add expandable rows.
   - Use one compact toggle per scenario row.
   - Render a second detail row only for expanded items.
   - Keep the default view unchanged and compact.

3. Refine styles.
   - Add a subtle radius to table wrappers.
   - Style the toggle and detail row so they feel native to the Spectre table.
   - Keep the interaction visually quiet.

4. Validate.
   - Run `vp fmt`.
   - Run `vp check`.
   - Run `vp test`.
   - Run `vp run build -r`.
   - Do a browser sanity check on the benchmark route.

## Acceptance Criteria

- Benchmark tables have a small rounded border.
- Scenario rows can be expanded and collapsed.
- Expanded detail text is useful and readable.
- The default benchmark view remains dense and uncluttered.
