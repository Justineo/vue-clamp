# Pretext LineClamp

## Decision

`vue-clamp` provides a separate predictive entry with the standard `LineClamp` API:

```ts
import { LineClamp } from "vue-clamp/pretext";
```

The root entry remains browser-authoritative and does not import `@chenglou/pretext`. The subpath is
a thin provider around the standard component, so native, predictive, and measured modes share one
DOM, observer lifecycle, accessibility tree, control model, and event contract.

Dispatch is semantic and ordered:

1. native CSS handles the exact end/grapheme/default-ellipsis subset;
2. Pretext handles non-native end truncation with `maxLines` and no `maxHeight`;
3. standard browser measurement handles every other combination.

Prediction includes observed `before` and `after` occupancy, custom single-line ellipses, and
grapheme boundaries when a custom ellipsis prevents native CSS. Ellipses with forced line breaks,
start or middle truncation, `maxHeight`, and rich markup remain measured.

## Model and runtime

A predictive line clamp needs source text, inline width, typography, and a line limit. The component
reads the rendered canvas font shorthand once and passes only the values Pretext models:
`white-space: pre-wrap`, `word-break: keep-all`, and numeric `letter-spacing`. Authored CSS still
renders normally, but automatic hyphenation, contextual spacing, font features, text transforms,
vertical writing, and dynamic typography are outside the prediction contract. A loaded named font
is recommended; Pretext documents `system-ui` as unsafe on macOS.

Preparation is cached by text, boundary, ellipsis, and typography. It combines Pretext segments and
widths with `vue-clamp` boundary offsets and segment cursor indexes. Resizing then walks only enough
lines to prove overflow, subtracts a leading affix from the first line, and reserves the ellipsis and
trailing affix on the final line. A leading affix also uses browser-compatible fresh-line emergency
wrapping for long tokens.

Font readiness and loading completion clear Pretext's shared measurement cache before instance
re-preparation. Clearing only the instance cache leaves fallback-font widths cached under the same
font name. Marker width belongs to the prepared instance and reuses Pretext's underlying metrics;
there is no separate unbounded marker cache. The line walker can return an oversized grapheme to
guarantee cursor progress, so spare rows alone must never be interpreted as a full fit. A leading
affix may move that grapheme to a fresh full-width line before truncation is necessary.

Each active instance owns one `ResizeObserver`, matching the standard components. Prediction observes
a zero-height width probe plus the existing affix wrappers. The observer provides exact width and
cached affix border boxes after layout and before paint; the component updates one stable visible
text node in that delivery without synchronous geometry reads or a Vue patch. Expanded, empty, and
unlimited instances do not observe.

The full source stays in a visually hidden accessible node. The visible node starts hidden and is
revealed with the first prediction before paint. CSS line clamp remains active as a line-box-aware
safety net for shaping outside the model. The implementation never derives a `max-height` from
`line-height`, because tall inline content can make the real line box exceed an `lh` estimate.

Native multiline selection uses the specified legacy `-webkit-line-clamp` combination directly.
That support predates the package's `ResizeObserver` baseline, while a render-time `CSS.supports`
branch made server and first-client markup diverge. Custom block ellipses remain non-native because
the interoperable legacy syntax accepts only an integer line count.

## Correctness evidence

Differential component tests compare prediction with standard browser measurement across 13 widths
for English, CJK, Thai, punctuation, composed accents, emoji, and long-token families. All 91
default-marker cases produce the same visible string. Separate tests cover computed typography,
custom ellipses, source and marker changes, slot geometry, expansion, events, accessibility,
pre-paint delivery, stable text-node identity, and inactive observation.

The retained stress corpus contains 13 text/marker combinations and 560 continuous, 560 jitter, and
560 jump changes per combination. Across 21,840 outputs, every prediction stays on a source boundary,
never keeps more content than browser measurement, and fits the three-line browser box.

Exact-prefix equality depends on the corpus:

- default-marker word scenarios match 10,029 of 10,080 outputs (99.5%);
- custom-marker word scenarios match 6,717 of 6,720 outputs (99.96%);
- custom-marker grapheme scenarios match 3,716 of 5,040 outputs (73.7%).

The custom-grapheme long-token fixture can keep up to 24 fewer graphemes. This is safe but not
browser-equivalent: the contract is a contained prefix on a valid boundary, not the browser's
globally maximal prefix.

An affix audit covers English, CJK, Thai, mixed scripts, emoji, custom ellipses, tall affixes, and
long tokens. All 18,480 results stay on source boundaries and within real browser line boxes; about
95.6% match browser measurement exactly. Most differences are conservative, with two
history-sensitive long-token widths retaining one additional fitting segment.

These results prove only the tested Chromium corpus. Platform fonts and unmodeled CSS remain the
documented accuracy-for-throughput trade-off of the opt-in entry.

## Performance evidence

The pure prepared-path benchmark runs 560 width changes per row. Representative powered runs show
roughly 96–99.9% less synchronous clamp work: browser measurement takes about 5–120 ms with hundreds
or thousands of geometry reads, while Pretext takes about 0.1–0.3 ms with none. Cold preparation can
take up to about 13 ms, so this is an amortized resize result rather than a one-off render claim.

The amplified 100,000-call benchmark shows the current core 11–39% faster than the initial
integration for English, CJK, and Thai. Segment cursor indexes remove repeated `Intl.Segmenter` work
inside long tokens; that fixture fell from 608–695 ms to 16.1–19.0 ms. A 1,000-item preparation
breakdown attributes about 19.3 ms to Pretext, 3.1 ms to word boundaries, and 21.2 ms to the complete
wrapper.

The release-facing same-process matrix is retained in
[`319-pretext-performance-matrix.md`](319-pretext-performance-matrix.md). It compares 16-instance
standard and Pretext entries using identical English, CJK, Thai, long-token, and affixed contracts.
Reactive width rows include parent rendering; direct outer-DOM rows isolate observer-driven runtime;
CSS-transition rows compare callback CPU and frame health because animation duration is fixed.

Current five-run medians show:

- 21 settled rows: aggregate active time falls 57.0%, from 4,632.9 ms to 1,990.0 ms;
- six direct-container rows: active time falls 71.3%, from 1,635.0 ms to 468.8 ms, with bounding-box
  reads falling from 37,392 to zero;
- direct affix rows: active time falls 72.1%, from 821.9 ms to 229.5 ms;
- reactive affix rows: active time falls 35.2%, from 505.9 ms to 327.7 ms, because both entries still
  execute slots during parent VNode updates;
- two 240 ms CSS transitions: ResizeObserver callback CPU falls 88.6% without affixes and 91.7% with
  affixes, recovering about 0.97–1.17 ms per frame on the benchmark host with zero dropped frames.

Many settled rows have high variance, so structural counters are the stronger regression signal.
Eligible Pretext rows perform no resize-time geometry or computed-style reads. Observer-driven width
changes also make no slot calls while `clamped` and `expanded` stay stable; real state transitions
render slots again because their public payload changed.

The shared standard runtime is intentionally not the absolute throughput ceiling. A historical
affix-free slice put the former dedicated component 30.7% ahead of the first shared-runtime version,
but it duplicated DOM, fallback, accessibility, and lifecycle ownership. Stable text-node updates
removed all predictive child-list replacements and cut that shared slice by 5.2%; specializing the
width probe removed another roughly 4.7–11.3% in counterbalanced aggregates. Later allocation changes
were retained only when they reduced bundle size or deterministic work without changing counters.

A shared-observer experiment reduced callback objects but not observed entries or callback CPU and
added about 1.18 kB raw. Independent observers remain both simpler and faster. An internal affix child
component also failed to reduce slot calls, because a new slot function is a legitimate update signal.

## Delivery cost

`@chenglou/pretext` is a regular dependency and an external package import in the library build.
Consumers therefore need no peer setup, while application bundlers include it only when the subpath
is imported.

| Consumer import      | Approximate gzip |
| -------------------- | ---------------: |
| Standard `LineClamp` |           9.6 kB |
| Pretext `LineClamp`  |          29.3 kB |
| Both entries         |          29.3 kB |

Sharing the component runtime makes importing both entries only about 17 bytes gzip larger than
Pretext alone. The private hook adds about 0.61 kB gzip to a standard-only consumer; this bounded cost
is accepted to avoid two divergent component implementations.

## Deliberate boundaries

- No public engine prop: the subpath is the dependency and policy boundary.
- No width prop: applications usually do not know the final content-box width, and observer delivery
  resolves it before paint without pushing width through every child VNode.
- No typography prop: the rendered style is the source of truth for the modeled subset.
- No affix-stability hint: observed size changes already invalidate geometry, while stable size does
  not prove that a slot's captured content is stable.
- No shared observer: fewer callbacks did not mean less work.
- No browser-search hint mode: the measured engine already maintains an effective previous-result
  hint, so another model does not justify its preparation cost.
- No copied Pretext line walker: most remaining prepared-call time is inside
  `layoutNextLineRange()`. Improving its allocation contract belongs upstream rather than in a forked
  browser-profile-sensitive algorithm.
- No result cache, typed rank arrays, full-layout prepass, or synchronous width read: measured spikes
  were slower, larger, or caused layout thrashing.

## Sources

- `@chenglou/pretext` `0.0.8` README and published sources
- MDN `line-clamp` reference and compatibility data:
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp>
- MDN browser-compat-data `line-clamp` record:
  <https://github.com/mdn/browser-compat-data/blob/main/css/properties/line-clamp.json>
- MDN browser-compat-data `ResizeObserver` record:
  <https://github.com/mdn/browser-compat-data/blob/main/api/ResizeObserver.json>
- W3C Resize Observer processing model: <https://www.w3.org/TR/resize-observer/>
- `journey/research/314-paid-signal-cold-search.md`
- `journey/research/315-final-architecture-sprint.md`
