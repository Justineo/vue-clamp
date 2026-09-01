# Pretext LineClamp

## Decision

`vue-clamp` provides a separate `vue-clamp/pretext` entry for applications that want a faster resize
hot path without changing the standard `LineClamp` contract:

```ts
import { LineClamp } from "vue-clamp/pretext";
```

The root entry remains browser-authoritative and does not import `@chenglou/pretext`. The subpath is
an opt-in acceleration policy: native CSS remains first, the predictor handles its selected API
shape, and every other combination continues into standard measurement. The subpath is a thin
provider around the standard `LineClamp`: all modes share one DOM, observer, accessibility tree,
controls, events, and measured solver, while only the private predictor stays opt-in. The wrapper
introduces no second clamp runtime and does not pull Pretext into root consumers.

## First-principles contract

A pure predictive line clamp needs source text, available inline width, a modeled typography
snapshot, and a line limit. Everything else either changes those facts or requires browser layout
knowledge that Pretext does not own. That limits prediction accuracy, not the public component.

The subpath exposes exactly the standard `LineClamp` props, slots, controls, events, and defaults.
Dispatch follows one semantic order:

1. the standard native end/grapheme/default-ellipsis subset uses native CSS;
2. non-native end `maxLines` cases with no `maxHeight` use Pretext, including observed `before` and
   `after` wrapper occupancy;
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
   subtract a leading affix from the first line, reserve the selected ellipsis and trailing affix on
   the final line, map the resulting cursor in constant time, and render that prefix. Leading-affix
   long tokens use browser-compatible fresh-line emergency wrapping.

The resize hot path performs no DOM geometry reads or browser candidate search. `ResizeObserver`
delivers the width after browser layout and before paint; Pretext arithmetic produces the text inside
that callback. The Resize Observer processing loop recalculates layout again after callback DOM
changes and before rendering, so exact discovery does not require width to be application state.
The standard measured solver remains the authority for API combinations outside the predictive
branch. CSS features outside Pretext's model are retained in the DOM and accepted as prediction
tradeoffs.

Native, predictive, and measured modes use the standard multiline runtime. Each active instance owns
one observer; expanded, empty, and unlimited instances do not observe. Prediction switches that
observer from root/content settlement to an empty zero-height width probe plus the existing affix
wrappers. The probe follows the same inline size but does not change block size when the callback
rewrites text, preventing resize feedback deliveries. Affix entry snapshots provide reusable numeric
widths as well as the signatures already consumed by the measured and Rich runtimes.

The accessible full source and the `aria-hidden` visible text nodes remain mounted in all states.
Resize delivery resolves all changed entries in one batch and writes a changed prefix directly into
the existing visible text node. It schedules no Vue component patch, creates or removes no nodes, and
does no work for an unchanged result.

The initial predictive DOM contains both a visually hidden accessible source and an `aria-hidden`
visible full source. The visible node starts `visibility: hidden`; the first observer delivery
rewrites and reveals it inside the pre-paint callback. A CSS line clamp remains active as a
line-box-aware safety net for stale or imperfect predictions. The component deliberately derives no
`max-height` from `line-height`: atomic inline boxes can make actual line boxes taller than an `lh`
budget, and the standard measured model does not make that approximation either. A zero-width result
becomes an empty visible prefix. No prediction state, width input, or affix-stability promise is
public.

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
breaks, start/middle truncation, `maxHeight`, and rich markup stay browser-measured. Platform fonts,
text transforms, unmodeled spacing, vertical writing, automatic hyphenation, and arbitrary inherited
CSS remain explicit predictive accuracy tradeoffs. A differential Chromium affix audit covered
English, CJK, Thai, mixed scripts, emoji, custom ellipses, tall affixes, and long tokens across
continuous, jitter, and jump widths. All 18,480 outputs stayed on source boundaries and fit real
browser line boxes; about 95.6% matched browser-authoritative output exactly. Most differences were
conservative shorter prefixes, while two history-sensitive long-token widths kept one additional
fitting segment.

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
| Smooth  |             200 / 4,800 / 4,800 |             0 |              101 |         199.1 ms |
| Jumps   |             200 / 4,800 / 4,800 |             0 |            4,000 |         224.8 ms |

Before the stable-DOM change, the same profiles required 101 / 3,200 VNode updates and 202 / 7,200
mutation records. Wall time remains dominated by animation-frame waits and is not treated as CPU
time; the durable result is that every resize now bypasses Vue and structural DOM patching. Replacing
the former shared observer with independent observers changed only observer/callback counts: entries,
DOM work, and wall time remained effectively flat. Pretext therefore follows the standard component
lifecycle instead of retaining global subscription state for an unmeasured optimization.

The release-facing public-component slice is retained in
[`319-pretext-performance-matrix.md`](319-pretext-performance-matrix.md). It interleaves the root and
`vue-clamp/pretext` entries in one Chromium process over 16-instance English, CJK, Thai, long-token,
and before-and-after affix batches, with continuous, bounded-jitter, and large-jump widths. It now
separates two resize drivers:

- reactive rows change the component's width-bearing Vue attrs, deliberately including parent render
  and slot reevaluation;
- direct DOM rows change only the outer container width, leaving the `LineClamp` VNode untouched and
  isolating the observer-driven runtime used by CSS layout, grids, panels, and viewport changes.

The retained report was regenerated while the benchmark host was on AC power. It contains 21 settled
resize rows plus two real CSS-transition rows. Five-run medians show:

- Across the 21 settled resize rows, aggregate active time falls about 57.0%, from 4,632.9 ms to
  1,990.0 ms. Sixteen rows fail the strict variance gate, so timing percentages remain directional;
  the exact structural counters are the stronger regression contract.
- In the six direct-container rows, active time falls 71.3%, from 1,635.0 ms to 468.8 ms. Bounding-box
  reads fall from 37,392 to zero and mutation records fall 77.8%, from 18,142 to 4,030.
- Direct affix rows fall 72.1%, from 821.9 ms to 229.5 ms. Each entry makes exactly 416 calls to each
  affix slot: 32 during real clamped-state transitions in the continuous row, zero while the jitter
  row stays clamped, and 384 across the large-jump transitions. Prediction therefore does not render
  an affix slot merely because width changed; it renders again only when the public `clamped` payload
  can change.
- Reactive affix rows fall 35.2%, from 505.9 ms to 327.7 ms, while both entries make 3,088 calls to
  each affix slot. Those calls come from the benchmark's parent VNode updates and are not predictor
  work. Arbitrary slots may capture parent state, so caching their VNodes would change the public slot
  contract even if their measured boxes happen to stay stable.
- Across the original 15 reactive rows, bounding-box reads still fall from 112,601 to zero, mutation
  records from 109,289 to 55,010, and both entries report the same 13,360 resize callbacks. The
  Pretext path performs zero computed-style reads after preparation.
- In the direct affix audit, 560 prepared width changes took about 0.1–0.4 ms with no geometry reads,
  versus about 8–70 ms and 617–3,261 reads for browser-authoritative search. Cold preparation took
  roughly 0.4–9 ms, so these figures describe the amortized resize path rather than first render.
- Aggregate settled time is flat because both entries wait for the same quiet frames; it is not a
  CPU-speed signal. The matrix deliberately excludes cold preparation and bundle size, which remain
  separate delivery costs.

The transition rows set the outer width once and let the browser interpolate it over two 240 ms
linear transitions, so their fixed active/settled duration is deliberately excluded from aggregate
speed claims. Across 16 instances, standard-to-Pretext ResizeObserver callback CPU falls from 63.3 ms
to 7.2 ms without affixes (-88.6%) and from 73.9 ms to 6.1 ms with affixes (-91.7%). At the benchmark
host's cadence, that is about 0.97–1.17 ms of main-thread headroom recovered per animation frame.
Both entries record zero dropped frames and roughly 10 ms frame p95, so this load demonstrates extra
headroom rather than a shorter CSS animation. A counters-off repetition produced 67.1 ms versus
7.4 ms and 65.3 ms versus 7.5 ms, confirming that the callback reduction is not layout-spy overhead.

A shared-observer A/B reduced 928 callback objects to 58 while preserving 928 observed entries, but
Pretext callback CPU remained flat (8.7 ms to 8.8 ms without affixes; 7.0 ms to 7.2 ms with affixes),
standard callback CPU did not improve, and the production package grew by about 1.18 kB raw. The
independent observer remains the smaller and faster choice; callback count alone is not a work metric.

A follow-up isolated each affix behind an internal child component to see whether Vue could skip slot
execution during parent width updates. It did not reduce the public render-function fixture's 1,152
calls to either slot because new slot-function identities are a legitimate update signal. Standard
active time was effectively flat (255.2 ms to 258.6 ms), while Pretext moved from 192.9 ms to 207.1 ms
with overlapping uncertainty, and the build grew by 0.55 kB raw / 0.10 kB gzip. The extra component
boundary was reverted. A size-stability hint would not change this safety boundary: stable geometry
does not imply stable slot content. A stronger output-stability contract would add public invalidation
semantics only for Vue-driven parent rerenders, while observer-driven resizes already avoid the calls.

### Shared-runtime architecture A/B

An AC-powered, same-process comparison isolates the current provider-based architecture from commit
`a1cfda9`, before prediction moved into the standard `LineClamp` runtime. It uses the 12 common
affix-free scenarios from the public matrix, so the added affix capability does not affect the result:

| Target                        | Active time | Versus standard | BBox reads | Mutation records | Child-list records | Resize callbacks |
| ----------------------------- | ----------: | --------------: | ---------: | ---------------: | -----------------: | ---------------: |
| Standard current              |  2,769.5 ms |               — |     88,057 |           91,257 |              7,283 |           10,688 |
| Pretext before shared runtime |  1,263.0 ms |          -54.4% |          0 |           43,778 |                  0 |           10,688 |
| Pretext with shared runtime   |  1,650.3 ms |          -40.4% |          0 |           43,778 |              5,825 |           10,688 |

The shared architecture is therefore 30.7% slower than the former dedicated Pretext hot path in
this historical run, while remaining 40.4% faster than browser measurement. It established the
former dedicated component as the architectural throughput ceiling, not as the implementation to
restore: duplicating DOM, fallback, accessibility, and lifecycle ownership is still rejected.

The identified structural loss has since been removed. A final same-process comparison used the 12
common scenarios before and after the retained hot-path changes:

| Shared-runtime target | Active time | BBox reads | Mutation records | Child-list records | Added / removed nodes | Resize callbacks |
| --------------------- | ----------: | ---------: | ---------------: | -----------------: | --------------------: | ---------------: |
| Before hot-path fixes |  1,547.3 ms |          0 |           43,778 |              5,825 |         5,825 / 5,825 |           10,688 |
| Optimized             |  1,466.3 ms |          0 |           43,778 |                  0 |                 0 / 0 |           10,688 |

The aggregate active reduction is 5.2%. The explicit text VNode converts every structural rewrite
into an in-place character-data update, preserving the text node across successive widths. A second
retained optimization specializes only the zero-border predictive width probe: it stores numeric
inline size directly instead of allocating generic width/height signatures or a size-snapshot object
and using the shared element-size `WeakMap`. An immutable snapshot is materialized only for the rare
non-observer recompute that asks for it. Two counterbalanced six-scenario runs put the original
specialization about 4.7–11.3% below the stable-text-node baseline in aggregate; individual
multilingual rows remain noisy, so the structural elimination and counterbalanced aggregate are
stronger evidence than any one row.

A later five-round allocation audit kept three small reductions: affix widths are passed to the
private prepared solver without a per-delivery options object, the observer retains predictive width
as a number, and affix signature strings are built only if prediction declines and browser measurement
actually runs. A final simplification narrowed the private prediction input and hoisted static
predictive styles out of component instances. Together these changes shrink the built Pretext path by
about 0.3 kB raw and 0.1 kB gzip. In a same-process eight-row slice before the final static cleanup,
summed medians were 5.1% lower and summed means were 2.0% lower than the pre-audit build, with identical
resize and mutation counts. Most row-level confidence intervals still overlapped, so this is treated
as a low-risk allocation and size improvement rather than a user-facing throughput claim. Reusing one
mutable prediction-input object and caching complete affix snapshots were removed: neither produced
order-independent timing, and both increased state or bundle size.

The latest shared-runtime cleanup likewise keeps only deterministic reductions: it reads cached
before/after snapshots directly, creates the measured-only affix signature and size predicate only
after prediction declines, and carries the already-known predictor state through commit and render
helpers instead of resolving it again. The production build fell from 155.54 kB to 155.44 kB raw
(shared chunk 53.67 kB to 53.57 kB; 12.71 kB to 12.69 kB gzip) with identical DOM, observer, slot,
and mutation counts. Separate timing runs were noisier than this change, so no throughput percentage
is attributed to it. Hoisting the provider's forwarding callbacks and factoring prediction eligibility
into another helper were also tried; they increased the production build to 155.71 kB and did not
improve the next full matrix, so both were reverted.

The remaining gap to the former dedicated component is the cost of the additional shared
`LineClamp` DOM and orchestration around the otherwise negligible prepared predictor call. Attempts
to specialize the prediction commit, cache eligibility, or make the coalescing runner synchronous
did not reproduce an aggregate gain and increased code or bundle size, so they were removed.

The low-gain multilingual rows can be approximated as a cost budget from the same run. Browser
geometry is the measured time spent inside bounding-box reads; the residual is standard work outside
those calls. Predictor overhead is the amount by which current Pretext exceeds that residual:

| Scenario        | Browser active | BBox time | Standard residual | Shared Pretext before fixes | Predictor-path overhead | Net saving |
| --------------- | -------------: | --------: | ----------------: | --------------------------: | ----------------------: | ---------: |
| CJK continuous  |       191.7 ms |   91.2 ms |          100.5 ms |                    164.6 ms |                 64.1 ms |    27.1 ms |
| Thai continuous |       206.5 ms |  100.9 ms |          105.6 ms |                    172.4 ms |                 66.8 ms |    34.1 ms |
| Thai jitter     |       213.0 ms |  103.3 ms |          109.7 ms |                    208.7 ms |                 99.0 ms |     4.3 ms |

Each row contains 1,120 instance deliveries. The browser path needs only 4.2–4.7 bounding-box reads
per delivery in these nearby-width workloads because its retained clamp hint starts near the next
answer. Removing geometry therefore saves only about 81–92 microseconds per delivery, while the
pre-fix shared predictor path added about 57–88 microseconds over the standard non-geometry residual.
Thai jitter was the cancellation boundary in that run: its roughly 4-millisecond total difference
was well inside the sampling uncertainty. The final matrix moves the same rows in the favorable
direction, but most remain high-variance. By contrast, the long-token continuous row needs 14.2
reads and about 310 microseconds of geometry per delivery, so predictor overhead is easily amortized.

`vp run benchmark:pretext:matrix` rebuilds both public entries, runs the interleaved slice, and
regenerates its Markdown, SVG, and ignored raw JSON artifacts.

## Delivery cost

The size audit builds production consumer entries with Vue externalized. It measures the standard
and Pretext subpaths separately and together. `@chenglou/pretext` is a regular package dependency so
the subpath works without peer setup, but bundlers only include it when `vue-clamp/pretext` is
imported.

| Consumer import      |      Gzip |
| -------------------- | --------: |
| Standard `LineClamp` |  9.609 kB |
| Pretext `LineClamp`  | 29.272 kB |
| Both components      | 29.289 kB |

The Pretext entry uses the same standard component runtime as the root entry, so importing both adds
only 17 bytes gzip beyond the Pretext-only consumer after bundler deduplication. The private strategy
hook and shared predictive branches add about 0.61 kB gzip to the standard-only consumer relative to
the preceding split-runtime build; this is the accepted delivery cost of eliminating two divergent
DOM, observer, fallback, and accessibility implementations. The predictor remains the principal
delivery cost.
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
- **Public affix-stability hints:** the shared runtime already receives exact wrapper-size changes
  from `ResizeObserver`, and the retained solver models first/final-line occupancy. Size stability
  cannot authorize caching content that may capture parent state. An output-stability promise could
  skip some Vue-driven slot calls, but would create a caller invalidation contract for a path that
  observer-driven resizing already avoids.

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
