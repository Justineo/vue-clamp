# Hero And npmx Refresh

Date: 2026-04-04

## Goal

Tighten the website hero so it reads as a structured product introduction instead of a loose landing-page stack, reduce unnecessary Vue 3 emphasis, and replace npm-facing external links with npmx while using official branding.

## Frontend Thesis

- Visual thesis: a quiet editorial split hero with one dominant text column and one compact structural rail.
- Content plan: product name, promise, supporting sentence, outbound links and badges, then a concise surface map.
- Interaction thesis: keep motion unchanged, improve reading order and focus treatment through clearer grouping instead of more chrome.

## Work

1. Verify the correct npmx URL pattern and official logo source.
2. Remove the hero kicker and rewrite the hero copy with less Vue 3 emphasis.
3. Rework the hero into a restrained split layout with a secondary surface rail.
4. Swap external package links from npm to npmx and add the npmx logo asset.
5. Apply `scrollbar-width: thin` globally.
6. Format and rerun the browser demo test.
