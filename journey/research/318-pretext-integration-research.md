# Pretext LineClamp

## Decision

`vue-clamp` provides a separate `vue-clamp/pretext` entry for applications that can trade the
general browser-authoritative contract for a smaller semantic surface and a faster resize hot path:

```ts
import { LineClamp } from "vue-clamp/pretext";
```

The root entry remains browser-authoritative and does not import `@chenglou/pretext`. Pretext is not
an `engine` prop or an automatic fast path because those designs would load the predictor for users
who did not select its contract and would mix two different sources of layout truth inside one
component.

## First-principles contract

A pure predictive line clamp needs four facts: source text, available inline width, a canvas font
shorthand, and a line limit. Everything else either changes those facts or requires browser layout
knowledge that Pretext does not own.

The public props therefore contain only:

- `text`
- required `font`
- `maxLines`
- `expanded` / `v-model:expanded`
- `as`

The component retains the standard imperative `expand`, `collapse`, and `toggle` controls and emits
`clampchange`. It fixes the clamp semantics to end truncation, word boundaries with grapheme fallback,
and the default `…`. It does not accept `maxHeight`, `location`, `boundary`, `ellipsis`, or affix slots.

The required `font` is both the Pretext measurement input and an inline style on the rendered body.
The body also fixes the text features that define the supported layout model: horizontal writing,
normal whitespace, normal word breaking, `overflow-wrap: break-word`, no text transform, normal
letter/word spacing, and no automatic hyphenation. A named font must be registered before the
component is mounted; `system-ui` remains outside the accuracy contract.

## Runtime model

The implementation has two phases:

1. Prepare the text once for each `text` / `font` pair. Pretext performs segmentation and canvas
   measurement, while `vue-clamp` prepares word boundaries and a direct mapping from Pretext cursors
   to word/grapheme ranks. Ellipsis measurement is shared by font shorthand.
2. On each `ResizeObserver` content-box width, walk only the lines needed to establish overflow,
   reserve the default ellipsis on the final line, map the resulting cursor in constant time, and
   render that prefix.

The resize hot path performs no DOM geometry reads or browser candidate search. `ResizeObserver`
delivers the width; Pretext arithmetic produces the text. The implementation deliberately does not
fall back to the standard engine because doing so would make performance and semantics depend on a
hidden runtime mode.

Active instances share one content-box observer. Expanded, empty, and unlimited instances do not
observe at all, and the shared observer is released when its last active target disappears. Resize
results retain object identity when both visible text and clamp state are unchanged, so local width
changes that do not cross a text boundary do not schedule component patches.

Before the first observer result, server output and hydration render the full source under native
line-clamp plus an `lh` hard cap. Once a predicted prefix is visible, the full source remains in a
visually hidden node and the prefix is `aria-hidden`, matching the package's accessibility pattern.
No prediction state is public.

## Correctness evidence

The component is differentially tested against the standard browser-authoritative `LineClamp` with
`boundary="word"` across 13 widths for each of these families:

- English prose
- CJK text
- Thai text
- a long unbroken token requiring grapheme fallback

All 52 component cases produce identical visible strings. The retained resize benchmark covers
English, CJK, and Thai across continuous changes, bounded jitter, and large jumps: all 5,040 hot-path
outputs match browser authority.

These tests prove the published contract and corpus, not general equivalence with the browser inline
formatting model. Custom ellipses, affixes, platform fonts, text transforms, custom spacing, vertical
writing, rich markup, and arbitrary inherited CSS remain standard `LineClamp` use cases.

## Performance evidence

Each benchmark row executes 560 width changes after preparation and reports the median of five
counterbalanced Chromium runs:

| Scenario | Browser-authoritative time | Pretext time | Pretext remaining time | Pretext geometry reads |
| -------- | -------------------------: | -----------: | ---------------------: | ---------------------: |
| English  |                9.2–19.0 ms |       0.2 ms |               1.1–2.2% |                      0 |
| CJK      |                5.7–23.0 ms |       0.2 ms |               0.9–3.5% |                      0 |
| Thai     |               11.6–55.1 ms |       0.2 ms |               0.4–1.7% |                      0 |

This means the measured synchronous resize work falls by roughly 97–99.8%; it does not mean total
page render time falls by that amount. The browser path performs 424–1,937 authoritative geometry
reads per row, while the prepared Pretext path performs none and lets the browser batch later style
and paint work.

Preparation costs 2.2–9.5 ms in the same cold-cache fixtures. The entry is therefore intended for
high-volume or frequently resizing text, not as a claim that every one-off clamp is faster.

Because the ordinary 560-change rows are below reliable sub-millisecond resolution, the retained
benchmark also amplifies each path to 100,000 calls. Relative to the initial production version, the
current core takes 11–39% less time for English, CJK, and Thai. The largest removed cost was repeated
`Intl.Segmenter` work when a line ended inside a long token: the long-token fixture fell from
608–695 ms to 15.7–18.3 ms per 100,000 calls, a 97.3–97.7% reduction. A 1,000-item repeated
preparation batch fell from 26.6 ms to 21.6 ms after sharing ellipsis measurement.

The 200-instance benchmark separates browser deliveries from component work. Across 24 observed
width changes, active observer instances fall from 200 to 1 and observer callbacks from 4,800 to 24.
For smooth one-pixel changes, stable results reduce component updates from 4,800 to 101; large jumps
still update whenever the visible prefix actually changes. These counts are the durable evidence;
the accompanying wall time includes animation-frame waits and is not treated as CPU time.

## Delivery cost

The size audit builds production consumer entries with Vue externalized. It measures the standard
and Pretext subpaths separately and together. `@chenglou/pretext` is a regular package dependency so
the subpath works without peer setup, but bundlers only include it when `vue-clamp/pretext` is
imported.

| Consumer import      |      Gzip |
| -------------------- | --------: |
| Standard `LineClamp` |  9.097 kB |
| Pretext `LineClamp`  | 20.414 kB |
| Both components      | 28.872 kB |

The large predictor payload is the principal trade-off. The subpath is justified only when its
preparation cost and bytes are amortized across enough active resize work; the ordinary root import
continues to be the default recommendation.

## Deliberately rejected designs

- **Pretext as a browser-search hint:** the existing browser path already derives an effective hint
  from a geometry read it must perform, so an additional predictor does not improve cold layouts.
- **Adaptive hinting for large jumps:** it can reduce some browser probes, but adds a second model and
  policy for a much smaller gain than pure authority.
- **A shared component with an engine prop:** it weakens tree-shaking and makes one prop surface imply
  semantics that the Pretext engine cannot uphold.
- **Silent browser fallback:** it hides which performance contract the caller selected and would
  require shipping both engines in the opt-in path.

## Sources

- `@chenglou/pretext` `0.0.8` README and published sources
- `journey/research/314-paid-signal-cold-search.md`
- `journey/research/315-final-architecture-sprint.md`
