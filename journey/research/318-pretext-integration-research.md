# Pretext LineClamp

## Decision

`vue-clamp` provides a separate `vue-clamp/pretext` entry for applications that want a faster resize
hot path without changing the standard `LineClamp` contract:

```ts
import { LineClamp } from "vue-clamp/pretext";
```

The root entry remains browser-authoritative and does not import `@chenglou/pretext`. The subpath is
a drop-in acceleration policy: native CSS remains first, the predictor runs only inside its proven
model, and every other combination uses the standard measured component. Keeping that policy in a
separate entry prevents the predictor from loading for root consumers.

## First-principles contract

A pure predictive line clamp needs four facts: source text, available inline width, a canvas font
shorthand, and a line limit. Everything else either changes those facts or requires browser layout
knowledge that Pretext does not own. That limits the predictive branch, not the public component.

The subpath exposes the standard `LineClamp` props, slots, controls, events, and defaults plus an
optional `font`. Dispatch follows one semantic order:

1. the standard native end/grapheme/default-ellipsis subset uses native CSS;
2. end/word/default-ellipsis `maxLines` cases with a non-empty `font`, no `maxHeight`, and no declared
   affix slots use Pretext;
3. every other combination uses standard browser measurement.

The second step is the only predictive surface. Importing the subpath is the caller's explicit
assertion that repeated or high-volume resizing can amortize preparation and payload cost; the
component cannot know a workload's future resize count and does not benchmark itself at runtime.

## Native capability baseline

The implementation does not depend on the still-limited unprefixed `line-clamp` property. It emits
the legacy `display: -webkit-box`, `-webkit-box-orient: vertical`, and `-webkit-line-clamp` combination
that CSS Overflow 4 specifies as continuing behavior. MDN browser data records the prefixed property
from Chrome 6, Firefox 68, and Safari 5, with current Edge and mobile engines mirrored from their
upstream engines.

This is older than the package's existing `ResizeObserver` baseline: Chrome 64, Firefox 69, and
Safari 13.1. Any supported browser capable of running the component observation model therefore
already has the legacy multiline clamp primitive. A cached `CSS.supports` check had negligible CPU
cost but created different server and client render branches; removing it makes selection depend on
semantics alone and keeps SSR markup deterministic.

When present, `font` is both the Pretext measurement input and an inline style on the rendered body.
The body also fixes the text features that define the supported layout model: horizontal writing,
normal whitespace, normal word breaking, `overflow-wrap: break-word`, no text transform, normal
letter/word spacing, and no automatic hyphenation. A named font must be registered before the
component is mounted; `system-ui` remains outside the accuracy contract.

The predictive branch trusts that contract instead of calling `document.fonts.check()` or loading
fonts for every instance. Font registration and loading belong to the application; changing `font`
remains reactive, but the new named font must already be available when it is supplied.

## Runtime model

After native and measured cases have been dispatched away, the predictive implementation has two
phases:

1. Prepare the text once for each `text` / `font` pair. Pretext performs segmentation and canvas
   measurement, while `vue-clamp` prepares word boundaries and segment-level cursor ranks. A line
   ending inside a segment searches only that segment's word-boundary interval. Ellipsis measurement
   is shared by font shorthand, and ordinary non-normalizing source text avoids a redundant join.
2. For each exact observed content-box width, walk only the lines needed to establish overflow,
   reserve the default ellipsis on the final line, map the resulting cursor in constant time, and
   render that prefix.

The resize hot path performs no DOM geometry reads or browser candidate search. `ResizeObserver`
delivers the width after browser layout and before paint; Pretext arithmetic produces the text inside
that callback. The Resize Observer processing loop recalculates layout again after callback DOM
changes and before rendering, so exact discovery does not require width to be application state.
The standard engine remains the authority for inputs outside the predictive model.

Active instances share one content-box observer. Expanded, empty, and unlimited instances do not
observe at all, and the shared observer is released when its last active target disappears. Each
instance observes an empty zero-height width probe rather than the text body. The probe follows the
same inline size but does not change block size when the callback rewrites text, preventing resize
feedback deliveries.

The accessible full source and the `aria-hidden` visible text nodes remain mounted in all states.
Resize delivery resolves all changed entries in one batch and writes a changed prefix directly into
the existing visible text node. It schedules no Vue component patch, creates or removes no nodes, and
does no work for an unchanged result.

The initial DOM contains both a visually hidden accessible source and an `aria-hidden` visible full
source. The visible node starts `visibility: hidden`; the first observer delivery rewrites and reveals
it inside the pre-paint callback. Native line clamp and overflow clipping remain active for stale
predictions. The component deliberately derives no `max-height` from `line-height`: atomic inline
boxes can make actual line boxes taller than an `lh` budget, and the root component's measured model
does not make that approximation either. A zero-width result becomes an empty visible prefix. No
prediction state or width input is public.

## Correctness evidence

The component is differentially tested against the standard browser-authoritative `LineClamp` with
`boundary="word"` across 13 widths for each of these families:

- English prose
- CJK text
- Thai text
- a long unbroken token requiring grapheme fallback
- punctuation with segment-internal word boundaries
- composed accents and emoji graphemes
- a long token following an earlier whole-word candidate

All 91 component cases produce identical visible strings. The retained resize benchmark covers
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
| English  |               10.9–22.2 ms |   0.2–0.3 ms |               0.9–1.8% |                      0 |
| CJK      |                6.6–25.5 ms |   0.1–0.2 ms |               0.8–1.6% |                      0 |
| Thai     |               12.2–61.5 ms |   0.1–0.2 ms |               0.3–0.8% |                      0 |

This means the measured synchronous resize work falls by roughly 97–99.8%; it does not mean total
page render time falls by that amount. The browser path performs 424–1,937 authoritative geometry
reads per row, while the prepared Pretext path performs none and lets the browser batch later style
and paint work.

Preparation costs 2.5–12.1 ms in the same cold-cache fixtures. The entry is therefore intended for
high-volume or frequently resizing text, not as a claim that every one-off clamp is faster.

Because the ordinary 560-change rows are below reliable sub-millisecond resolution, the retained
benchmark also amplifies each path to 100,000 calls. Relative to the initial production version, the
current core takes 11–39% less time for English, CJK, and Thai. The largest removed cost was repeated
`Intl.Segmenter` work when a line ended inside a long token: the long-token fixture fell from
608–695 ms to 15.5–17.9 ms per 100,000 calls, a 97.4–97.8% reduction. In the retained 1,000-item
preparation decomposition, Pretext itself takes about 17.0 ms, word-boundary preparation 2.8 ms,
and the complete wrapper 19.9 ms. The added rank index is proportional to Pretext segments instead
of source graphemes.

The 200-instance benchmark separates browser delivery from component work across 24 changes:

| Profile | Observers / callbacks / entries | VNode updates | Mutation records | Resize wall time |
| ------- | ------------------------------: | ------------: | ---------------: | ---------------: |
| Smooth  |                  1 / 24 / 4,800 |             0 |              101 |         199.9 ms |
| Jumps   |                  1 / 24 / 4,800 |             0 |            4,000 |         225.1 ms |

Before the stable-DOM change, the same profiles required 101 / 3,200 VNode updates and 202 / 7,200
mutation records. Wall time remains dominated by animation-frame waits and is not treated as CPU
time; the durable result is that every resize now bypasses Vue and structural DOM patching.

The release-facing public-component slice is retained in
[`319-pretext-performance-matrix.md`](319-pretext-performance-matrix.md). It interleaves the root and
`vue-clamp/pretext` entries in one Chromium process over 16-instance English, CJK, Thai, and long-token
batches, with continuous, bounded-jitter, and large-jump widths. The fixture supplies its exact
CSS width to both entries and measures the public observer-driven Pretext path. The retained report
was regenerated while the benchmark host was on AC power. Five-run medians show:

- Pretext is faster in all 12 rows. Active time falls 47.3–86.6% per row and 74.0% in aggregate,
  from 2,142.4 ms to 557.2 ms. Two rows cross the matrix's variance gate, so those timing deltas
  remain directional rather than precise point estimates.
- Bounding-box reads fall from 88,057 to zero, ResizeObserver callbacks fall 93.8% from 10,688 to the
  exact 668 measured width steps, and mutation records fall 52.0% from 91,257 to 43,778. Pretext has
  no child-list mutation in any row.
- The former English jump regression is removed: active time falls 73.4%, from 82.2 ms to 21.9 ms.
  The width probe prevents text-height changes from creating extra observer deliveries.
- Aggregate settled time is flat because both entries wait for the same quiet frames; it is not a
  CPU-speed signal. The matrix deliberately excludes cold preparation and bundle size, which remain
  separate delivery costs.

`vp run benchmark:pretext:matrix` rebuilds both public entries, runs the interleaved slice, and
regenerates its Markdown, SVG, and ignored raw JSON artifacts.

## Delivery cost

The size audit builds production consumer entries with Vue externalized. It measures the standard
and Pretext subpaths separately and together. `@chenglou/pretext` is a regular package dependency so
the subpath works without peer setup, but bundlers only include it when `vue-clamp/pretext` is
imported.

| Consumer import      |      Gzip |
| -------------------- | --------: |
| Standard `LineClamp` |  9.000 kB |
| Pretext `LineClamp`  | 29.120 kB |
| Both components      | 29.135 kB |

The Pretext entry now includes the standard component needed for exact native and measured dispatch;
importing both adds almost nothing because bundlers deduplicate that fallback. The predictor remains
the principal delivery cost. The subpath is justified only when its preparation cost and bytes are
amortized across enough active resize work; the ordinary root import continues to be the default
recommendation.

## Current optimization boundary

The npm `latest` tag still points to `@chenglou/pretext` `0.0.8`. Upstream `main` at
`ac49b09b7d83ede19581fa94a8b892b07d309baf` contains unreleased analysis and measurement
simplifications but no new low-allocation cursor API. In a seven-run, counterbalanced Chromium spike
over 1,000 dashboard rows, its median `prepareWithSegments()` time was 10.2 ms versus 12.8 ms for the
published package, about 20% faster. The source tree does not publish built `dist` files from Git, so
pointing the package dependency at that commit is not a safe consumer delivery path; vendoring or
maintaining a fork would be a separate dependency-policy decision.

A second spike separated the current wrapper from `layoutNextLineRange()` using 200,000 clamp calls:

| Scenario   | Range walking | Complete wrapper | Range share |
| ---------- | ------------: | ---------------: | ----------: |
| English    |       26.6 ms |          28.5 ms |       93.3% |
| CJK        |       30.5 ms |          32.0 ms |       95.3% |
| Long token |       26.7 ms |          30.0 ms |       89.0% |

Each public `layoutNextLineRange()` call allocates its result and cursor objects. The remaining
meaningful hot-path opportunity therefore belongs upstream: an API that advances a caller-owned
cursor and returns geometry without materializing range objects. Copying Pretext's internal line
walker into `vue-clamp` would duplicate a large, browser-profile-sensitive algorithm and break the
chosen authority boundary.

Local alternatives were measured and rejected: result caches slowed mixed scripts and jumps;
typed rank arrays traded a small hot-path regression for memory; a full `layout()` prepass doubled
ordinary core time and made the long-token path roughly nine times slower. Synchronous geometry reads
made the 200-instance jump case regress from about 225 ms to 540 ms through layout thrashing. An
optional exact-width prop performed well in an artificial controlled matrix but moved discovery to
callers that ordinarily do not own content-box size; propagating one reactive width through 200
children caused 4,800 VNode updates. Sync watcher flushes and independent observers also had no
reproducible benefit.

Allowing the full source to exist in DOM before paint changed the useful local boundary. Permanently
mounting both accessibility nodes lets observer delivery mutate one stable text node, and observing a
zero-height width probe prevents the mutation from producing block-size feedback. These are retained
because they remove Vue and structural DOM work without adding public state. The remaining local
algorithmic work has no reproducible benefit large enough to justify more state or semantic risk.

## Deliberately rejected designs

- **Pretext as a browser-search hint:** the existing browser path already derives an effective hint
  from a geometry read it must perform, so an additional predictor does not improve cold layouts.
- **Adaptive hinting for large jumps:** it can reduce some browser probes, but adds a second model and
  policy for a much smaller gain than pure authority.
- **A shared component with an engine prop:** it weakens tree-shaking and makes one prop surface imply
  that root consumers may load an engine they did not select. The separate subpath provides the same
  drop-in behavior without changing the root dependency graph.

## Sources

- `@chenglou/pretext` `0.0.8` README and published sources
- MDN `line-clamp` reference and browser compatibility data:
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp>
- MDN browser-compat-data `line-clamp` record:
  <https://github.com/mdn/browser-compat-data/blob/main/css/properties/line-clamp.json>
- MDN browser-compat-data `ResizeObserver` record:
  <https://github.com/mdn/browser-compat-data/blob/main/api/ResizeObserver.json>
- W3C Resize Observer processing model: <https://www.w3.org/TR/resize-observer/>
- `journey/research/314-paid-signal-cold-search.md`
- `journey/research/315-final-architecture-sprint.md`
