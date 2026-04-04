# Hero Live Proof Strip

Date: 2026-04-04

## Goal

Replace the static hero metadata treatment with a live proof strip that cycles through `LineClamp`, `InlineClamp`, and `WrapClamp` while keeping the headline accurate and stable.

## Plan

1. Replace the hero surface pills with one autoplaying proof strip under the headline.
2. Keep the headline literal and accurate instead of animating the headline text itself.
3. Cycle the proof strip through `LineClamp`, `InlineClamp`, and `WrapClamp` with subtle width changes.
4. Respect `prefers-reduced-motion` and pause autoplay on hover or focus.
5. Demote links below badges so the proof strip becomes the visual anchor.
6. Format and rerun the demo browser test.
