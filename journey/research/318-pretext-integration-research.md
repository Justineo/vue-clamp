# Pretext LineClamp

## Decision

`vue-clamp` provides a separate `vue-clamp/pretext` entry for applications that want a faster resize
hot path without changing the standard `LineClamp` contract:

```ts
import { LineClamp } from "vue-clamp/pretext";
```

The root entry remains browser-authoritative and does not import `@chenglou/pretext`. The subpath is
an opt-in acceleration policy: native CSS remains first, the predictor handles its selected API
shape, and every other combination delegates to the standard `LineClamp`. Keeping the predictive
policy in a separate entry prevents the predictor from loading for root consumers and keeps its fast
path free of the fallback component's runtime state.

## First-principles contract

A pure predictive line clamp needs source text, available inline width, a modeled typography
snapshot, and a line limit. Everything else either changes those facts or requires browser layout
knowledge that Pretext does not own. That limits prediction accuracy, not the public component.

The subpath exposes exactly the standard `LineClamp` props, slots, controls, events, and defaults.
Dispatch follows one semantic order:

1. the standard native end/grapheme/default-ellipsis subset uses native CSS;
2. end `maxLines` cases with no `maxHeight` or declared affix slots use Pretext when they request
   word boundaries or a custom single-line ellipsis;
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

CSS Overflow 4 specifies custom block ellipses through `line-clamp: <integer> <string>` and
`block-ellipsis`, but the interoperable legacy `-webkit-line-clamp` syntax accepts only an integer.
The current Chromium runtime used by the project rejects the unprefixed string syntax, so custom
ellipses remain non-native without adding an SSR-sensitive experimental capability branch.

The component does not add a typography prop or overwrite consumer text styles. Before the first
prediction it reads the rendered body's computed canvas font shorthand and maps only the options
Pretext supports: `white-space: normal | pre-wrap`, `word-break: normal | keep-all`, and numeric
`letter-spacing`. Unsupported values use Pretext's default model while the browser continues to
render the authored CSS. This is an intentional accuracy-for-throughput tradeoff of the opt-in entry,
not a second public configuration surface.

The typography snapshot is cached for the instance's resize lifetime, so width and component updates
perform no computed-style work. Dynamic inline, class, inherited-style, media/container-query,
automatic hyphenation, contextual spacing, and font-feature changes remain outside the predictor's
invalidation/model contract. Font registration and loading belong to the application; a loaded named
font is recommended and `system-ui` retains Pretext's documented macOS accuracy caveat.

## Runtime model

After native and measured cases have been dispatched away, the predictive implementation has two
phases:

1. Prepare the text once for each text / modeled-typography pair. Pretext performs segmentation and
   canvas measurement, while `vue-clamp` prepares word boundaries and segment-level cursor ranks. A
   line ending inside a segment searches only that segment's requested-boundary interval. Ellipsis
   measurement is shared by marker, font shorthand, and supported text options, and ordinary
   non-normalizing source text avoids a redundant join.
2. For each exact observed content-box width, walk only the lines needed to establish overflow,
   reserve the selected ellipsis on the final line, map the resulting cursor in constant time, and
   render that prefix.

The resize hot path performs no DOM geometry reads or browser candidate search. `ResizeObserver`
delivers the width after browser layout and before paint; Pretext arithmetic produces the text inside
that callback. The Resize Observer processing loop recalculates layout again after callback DOM
changes and before rendering, so exact discovery does not require width to be application state.
The standard engine remains the authority for API combinations outside the predictive branch. CSS
features outside Pretext's model are retained in the DOM and accepted as prediction tradeoffs.

Like the browser-authoritative components, each active instance owns its observer. Expanded, empty,
and unlimited instances do not observe at all. Each instance observes an empty zero-height width
probe rather than the text body. The probe follows the same inline size but does not change block
size when the callback rewrites text, preventing resize feedback deliveries.

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

All 91 default-marker component cases produce identical visible strings. In the wider resize matrix,
the baseline English, CJK, and Thai subset still matches all 5,040 browser-authoritative outputs.
Separate smoke cases cover computed-font input and propagation of numeric letter spacing,
`white-space: pre-wrap`, and `word-break: keep-all` into the predictor.

The retained differential stress matrix now covers 13 text/marker combinations: English, CJK,
Thai, emoji ZWJ sequences, regional-indicator flags, composed accents, mixed Arabic/CJK/Korean/Latin
text, and long unbroken tokens. Each combination runs 560 continuous changes, 560 bounded-jitter
changes, and 560 large jumps. Across all 21,840 outputs, every predicted result remains a source
prefix, keeps no more content than the browser-authoritative result, and directly fits within the
three-line limit.

Exact-prefix equality is corpus-dependent. The six default-marker word scenarios match 10,029 of
10,080 outputs (99.5%); only one repeated emoji jump width is conservative. The four custom-marker
word scenarios match 6,717 of 6,720 outputs (99.96%). The three custom-marker grapheme scenarios
match 3,716 of 5,040 outputs (73.7%): their predictions remain safe, but the long-token fixture can
keep up to 24 fewer graphemes. Therefore the earlier 99.8% English-only result must not be presented
as a general equivalence rate. The contract is containment plus a valid conservative boundary, not
exact maximum-prefix equivalence.

These tests prove only the published corpus, not general equivalence with the browser inline
formatting model or exact output for every value/width combination. Ellipses with forced line
breaks, affixes, start/middle truncation, `maxHeight`, and rich markup dispatch to standard
`LineClamp`. Platform fonts, text transforms, unmodeled spacing, vertical writing, automatic
hyphenation, and arbitrary inherited CSS remain explicit predictive accuracy tradeoffs.

## Performance evidence

Each benchmark row executes 560 width changes after preparation and reports the median of five
counterbalanced Chromium runs. Representative powered runs fall in these ranges:

| Scenario group                             | Browser-authoritative time | Pretext time | Pretext remaining time | Pretext geometry reads |
| ------------------------------------------ | -------------------------: | -----------: | ---------------------: | ---------------------: |
| Default marker, multilingual and edge text |                    5–70 ms |   0.1–0.3 ms |               0.3–3.6% |                      0 |
| Custom marker, multilingual and edge text  |                   6–120 ms |   0.1–0.3 ms |               0.1–3.4% |                      0 |

This means the measured synchronous resize work falls by roughly 96–99.9%; it does not mean total
page render time falls by that amount. The browser path performs 370–4,638 authoritative geometry
reads per row, while the prepared Pretext path performs none and lets the browser batch later style
and paint work.

Preparation costs up to about 13 ms in these fixtures. The entry is therefore intended for
high-volume or frequently resizing text, not as a claim that every one-off clamp is faster.

Because the ordinary 560-change rows are below reliable sub-millisecond resolution, the retained
benchmark also amplifies each path to 100,000 calls. Relative to the initial production version, the
current core takes 11–39% less time for English, CJK, and Thai. The largest removed cost was repeated
`Intl.Segmenter` work when a line ended inside a long token: the long-token fixture fell from
608–695 ms to 16.1–19.0 ms per 100,000 calls, a 96.9–97.7% reduction. In the retained 1,000-item
preparation decomposition, Pretext itself takes about 19.3 ms, word-boundary preparation 3.1 ms,
and the complete wrapper 21.2 ms. The added rank index is proportional to Pretext segments instead
of source graphemes.

The 200-instance benchmark separates browser delivery from component work across 24 changes:

| Profile | Observers / callbacks / entries | VNode updates | Mutation records | Resize wall time |
| ------- | ------------------------------: | ------------: | ---------------: | ---------------: |
| Smooth  |             200 / 4,800 / 4,800 |             0 |              101 |         199.4 ms |
| Jumps   |             200 / 4,800 / 4,800 |             0 |            4,000 |         224.9 ms |

Before the stable-DOM change, the same profiles required 101 / 3,200 VNode updates and 202 / 7,200
mutation records. Wall time remains dominated by animation-frame waits and is not treated as CPU
time; the durable result is that every resize now bypasses Vue and structural DOM patching. Replacing
the former shared observer with independent observers changed only observer/callback counts: entries,
DOM work, and wall time remained effectively flat. Pretext therefore follows the standard component
lifecycle instead of retaining global subscription state for an unmeasured optimization.

The release-facing public-component slice is retained in
[`319-pretext-performance-matrix.md`](319-pretext-performance-matrix.md). It interleaves the root and
`vue-clamp/pretext` entries in one Chromium process over 16-instance English, CJK, Thai, and long-token
batches, with continuous, bounded-jitter, and large-jump widths. The fixture supplies its exact
CSS width to both entries and measures the public observer-driven Pretext path. The retained report
was regenerated while the benchmark host was on AC power. Five-run medians show:

- Pretext is faster in all 12 observed medians. Active time falls 30.8–85.6% per row and about
  62.5% in aggregate, from 2,550.0 ms to 956.9 ms. Eleven rows fail the strict variance gate, so the
  timing deltas are directional; the structural counters below are the more stable evidence.
- Bounding-box reads fall from 88,057 to zero and mutation records fall 52.0% from 91,257 to 43,778.
  Both entries now use independent per-instance observers and report the same 10,688 callbacks, making
  the comparison reflect engine work rather than callback batching. Pretext has no child-list mutation
  in any row.
- The former English jump regression is removed: active time falls about 66.6%, from 95.2 ms to
  31.8 ms. The width probe prevents text-height changes from creating extra observer deliveries.
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
| Pretext `LineClamp`  | 29.090 kB |
| Both components      | 29.106 kB |

The Pretext entry includes the standard browser-authoritative component needed for exact native and
measured dispatch; the root entry exports that same component, so importing both adds almost nothing
because bundlers deduplicate it. The predictor remains the principal delivery cost.
The subpath is justified only when its preparation cost and bytes are amortized across enough active
resize work; the ordinary root import continues to be the default recommendation.

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
children caused 4,800 VNode updates. Sync watcher flushes had no reproducible benefit. A shared
observer collapsed observer and callback counts but not active work, so the final implementation uses
the same independent lifecycle as the browser-authoritative components.

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
- **Public affix-stability hints without a proven solver:** the existing wrapper is already atomic
  and no-wrap, so a caller guarantee that its dimensions stay constant is enough to reuse measured
  affix geometry even if its contents change. It does not solve first/last-line occupancy by itself.
  Do not add public props until that solver reduces browser work and elapsed time across
  representative affix workloads.

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
