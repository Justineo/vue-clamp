# Benchmark Visualization Overhaul

## Goal

Replace the current raw benchmark table with a purpose-built dashboard that makes the three core questions easy to answer:

- which engine is best overall
- where each engine wins or loses
- what workload characteristics drive the differences

The new UI should follow data-visualization best practices: clear hierarchy, restrained color use, explicit units, meaningful comparisons, accessible labels, and progressive disclosure for raw details.

## Problems In The Current Page

- It presents almost every metric in a flat table, so users must scan horizontally across many columns to infer the ranking.
- It does not visually separate overall conclusions from scenario-level evidence.
- It over-emphasizes exact decimals and under-emphasizes comparisons.
- It lacks a visual encoding for speed differences, so relative performance is harder to parse than it should be.
- It does not surface workload categories such as resize, text update, slots, or multilingual content in a compact way.
- It hides benchmark-environment context in plain text instead of treating it as supporting metadata.
- It exposes raw JSON, but there is no structured drill-down view between summary and full dump.

## Target Information Hierarchy

1. Header and run controls
   - benchmark purpose
   - run button
   - navigation back to demo
2. Executive summary
   - headline winner
   - geometric-mean comparison cards
   - win counts
3. Overall engine ranking
   - normalized performance bars across all scenarios
   - concise notes about strengths and weaknesses
4. Scenario matrix
   - one row or card per scenario
   - bars for each engine relative to the fastest engine in that scenario
   - badges for workload traits
   - correctness badges
5. Evidence and environment
   - browser, DPR, language, timestamp
   - optional raw JSON in details

## Implementation Plan

1. Extend the view-model layer inside `BenchmarkPage.vue`.
   - derive ranked engine summary objects from the raw report
   - derive scenario tags from scenario metadata
   - derive normalized relative bar widths for each scenario
   - derive readable narrative labels such as `fastest`, `close second`, `clear laggard`

2. Replace the current summary paragraph and flat table with a dashboard layout.
   - hero summary card
   - metric cards for geometric-mean speedups and win counts
   - engine ranking section with horizontal bars
   - scenario results section with compact visual rows/cards

3. Use a consistent visual language for performance.
   - one hue per engine, with colorblind-safe contrast
   - bars encode relative speed, not decoration
   - exact timings remain visible as labels, but bars carry the first-read meaning
   - use muted neutrals for secondary metadata

4. Improve scenario readability.
   - add tags for operation and content shape such as `resize`, `text update`, `slots`, `CJK`, `emoji`, `bidi`, `long token`
   - show only the most decision-relevant correctness badges inline
   - move verbose details into a per-scenario expandable region

5. Improve supporting metadata.
   - move environment info into a dedicated card grid
   - keep raw JSON in a collapsed details panel
   - label all units explicitly in `ms` and `x`

6. Keep implementation dependency-free.
   - use Vue computed state, semantic HTML, and CSS only
   - avoid chart libraries for a dashboard this small
   - prefer CSS grid/flex and simple bar primitives for maintainability

7. Validate and review.
   - run `vp check`, `vp test`, and `vp run build -r`
   - open the benchmark page and visually verify desktop and mobile layout

## Progress

- [x] Replace the flat table with a dashboard-oriented benchmark page.
- [x] Add derived view-model summaries for overall ranking, scenario bars, tags, and parity badges.
- [x] Introduce a benchmark-specific visual system with consistent engine colors and responsive cards.
- [x] Keep the page dependency-free and based on Vue computed state plus CSS.
- [x] Validate with `vp check`, `vp test`, and `vp run build -r`.
- [x] Verify the live page in headless Chromium at desktop and narrow mobile widths.

## Non-Goals

- No external charting dependency.
- No changes to the benchmark engine semantics in this pass.
- No hidden auto-sorting or dynamic filtering until the core layout is clearly better.
