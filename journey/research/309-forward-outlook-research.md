# Forward outlook research

Date: 2026-05-18

## Snapshot

`vue-clamp` is currently published as `1.4.0` and the local package matches that version. Several
previous post-1.3 outlook items are complete now:

- `LineClamp` already has explicit native modes for single-line `text-overflow` and conservative
  multiline `line-clamp`.
- `WrapClamp` has already gone through the large 1.5-era solver investigation summarized in
  `journey/research/308-wrapclamp-optimization-summary.md`.
- Remaining product-level open GitHub issues are not feature requests; the only open issue checked
  on 2026-05-18 was Renovate's dependency dashboard.

Recent product feedback is useful mostly as validation of the current surface:

- reverse / delimiter-aware path truncation was addressed through `InlineClamp` `location` plus
  `split`
- word-boundary requests are addressed through `boundary="word"`
- rich HTML requests are addressed through `RichLineClamp`
- tag / chip clamping requests are addressed through `WrapClamp`
- prior invalid HTML / SSR complaints are only partly addressed by `as`, not by a full SSR visual
  contract

NPM downloads for 2026-05-11 through 2026-05-17:

| Package                | Downloads |
| ---------------------- | --------: |
| `vue-clamp`            |     9,025 |
| `vue3-text-clamp`      |    17,090 |
| `vue-snip`             |     6,122 |
| `react-lines-ellipsis` |   115,154 |
| `@chenglou/pretext`    |   550,823 |

These numbers are directional only, but they suggest two things: Vue truncation remains a live
utility category, and text-measurement performance work is getting broad ecosystem attention.

## Platform facts that matter

### CSS native clamping is useful but still narrow

MDN still marks `line-clamp` as limited availability, and documents the legacy `-webkit-line-clamp`
co-dependency with `display: -webkit-box` / `-webkit-box-orient: vertical` as specified behavior.
The current implementation's conservative native multiline path is therefore still the right
posture.

CSS Overflow Level 4 defines the vocabulary the library would like to have long term:
`line-clamp`, `block-ellipsis`, `max-lines`, and `continue`. But MDN's CSS overflow reference says
the Level 4 longhands such as `block-ellipsis` and `max-lines` currently have no browser support.
That means custom multiline ellipsis and suffix slot reservation still belong in the measured JS
path.

`text-overflow` itself is broadly available and supports end-of-line overflow signaling, but it only
applies to inline-axis overflow. Its `<string>` custom-marker form is not broadly available:
Can I Use reports about 2.2% global support for `text-overflow: <string>`. So the current native
single-line path should keep default `…` only unless behavior tests prove a browser-specific exact
path is worth carrying.

`text-wrap: balance` / `pretty` are now Baseline 2024, and they can change actual soft line breaks.
This strengthens the decision to keep real DOM measurement as the final truth rather than deriving
line breaks from text length or a line-height model.

### Browser primitives are now solid baselines

`ResizeObserver` is Baseline widely available since 2020, matching the project's current browser
baseline decision.

`Intl.Segmenter` is Baseline 2024 and provides locale-sensitive grapheme / word / sentence
segmentation. The current implementation already uses it with an ASCII fast path. The remaining
question is whether `boundary="word"` should ever receive an explicit locale or inferred DOM
language; that is a public API trade-off, not a capability blocker.

`@media (scripting)` is Baseline 2023 and can distinguish no-JS from JS-enabled initial rendering.
This is directly useful for the existing SSR skeleton direction because it can keep full content
visible to no-JS users while showing a pending visual state only when JavaScript is active.

### Vue SSR gives enough hooks for a better contract

Vue's SSR guide confirms the constraints that matter here:

- `mounted` / `onMounted` and update hooks do not run during SSR, so browser measurement must stay
  client-only.
- Universal code cannot assume browser-only globals such as `window` / `document`.
- Hydration mismatches cause recovery work and should be eliminated where possible.
- Vue 3.5+ can selectively suppress inevitable mismatches with `data-allow-mismatch`, but that
  should not be the main strategy.

Vue 3.5 lazy hydration strategies (`hydrateOnIdle`, `hydrateOnVisible`,
`hydrateOnMediaQuery`, `hydrateOnInteraction`) are relevant for docs and integration recipes. They
probably should not be a built-in default for `vue-clamp`, but the library can document how to
combine its pending SSR output with framework-level lazy hydration.

Vue's TypeScript docs also confirm generic components are supported in SFCs and render/JSX
components, and `defineSlots` provides slot prop checking in SFCs. The later SFC migration uses
`<script setup generic>` for `WrapClamp`, so generic item-slot typing is no longer an open roadmap
item.

## Recommended directions

### 1. Design the SSR / hydration contract

Priority: high.

This is the biggest remaining product capability gap. The package currently measures in the browser
and has no CSS side-effect entry or server pending state. A good vNext direction is:

- preserve full source content in server HTML
- render the same pending state on the initial client pass
- switch to exact measured output only after mount
- use an optional stylesheet or explicit CSS entry for pending/skeleton visuals
- use `@media (scripting: enabled)` so no-JS users see full content
- allow exact native SSR only for proven native subsets

This should be treated as a public contract design, not a quick implementation detail, because it
introduces CSS delivery and hydration expectations. It also needs SSR tests with `renderToString`
and browser hydration checks, not only unit tests.

Suggested first artifact: an SSR design note that decides between a CSS side-effect entry,
`vue-clamp/ssr.css`, opt-in component prop, or documentation-only CSS recipe.

### 2. Make benchmarks release-visible

Priority: high.

The project already has useful browser benchmarks, and recent WrapClamp work proved that rejected
optimization attempts are as important as accepted ones. The next improvement is to turn benchmarks
into versioned assets:

- store JSON or Markdown snapshots by release / branch
- record stable counters in addition to elapsed time: slot calls, rect reads, `getClientRects`,
  DOM writes, fallback counts, patch counts
- add scenarios for LineClamp native vs measured, InlineClamp split/path cases, RichLineClamp
  nested markup, WrapClamp dynamic affixes, and SSR pending/hydration
- use soft thresholds or review-only CI output before hard failing on browser noise

This should happen before another broad solver rewrite or Pretext integration.

### 3. Add RichLineClamp development diagnostics

Priority: high-medium.

`RichLineClamp` intentionally falls back to raw HTML when inline layout is unsupported. That is safe,
but opaque. Development diagnostics would give users a reason and reduce issue churn:

- out-of-flow descendant: `position:absolute|fixed|sticky` or float
- non-inline wrapper that cannot be searched
- non-inline leaf that cannot be treated atomically
- zero-width / unmeasurable probe
- rich image without deterministic box sizing

The default production behavior should stay quiet. A low-risk path is to thread an internal
diagnostic enum out of `inspectLayout` / `clampRich`, then emit dev-only warnings or expose a debug
callback later if there is enough demand.

### 4. Explore Pretext only as an accelerator

Priority: medium.

`@chenglou/pretext` is a new, fast-moving text layout package. It is relevant because it aims to
avoid DOM reflow by preparing text once and running width-dependent layout as arithmetic. Its package
is still `0.0.x`, but adoption signals are strong enough to justify a benchmark spike.

The safe model for `vue-clamp` is:

- keep Pretext out of the main entry initially
- start with benchmark-only or an experimental subpath
- use it only for plain `LineClamp` candidate prediction
- always verify the predicted candidate against real DOM before committing
- avoid rich HTML, arbitrary slots, `WrapClamp`, and unmodeled CSS text behavior

Required comparison cases: CJK, Thai, emoji ZWJ, bidi text, `letter-spacing`, `hyphens`,
`overflow-wrap`, `word-break`, `text-wrap`, custom fonts, before/after slots, and zoom.

### 5. Keep WrapClamp runtime work benchmark-led

Priority: medium-low.

Runtime WrapClamp work is already deep and well benchmarked, and generic slot typing is now covered
by the SFC implementation. Further WrapClamp changes should target measured runtime wins or clear
public API demand.

Runtime WrapClamp work should stay benchmark-led. Rejected paths around arbitrary `after` and
static-affix hints should not be revived without a new proof and counter win.

### 6. Consider locale-aware word boundaries cautiously

Priority: medium-low.

The library already uses `Intl.Segmenter(undefined, { granularity: "word" })`, which follows the
runtime default locale. Some users may expect word boundaries to follow the content language,
especially for CJK/Thai/mixed-language snippets.

Possible approaches:

- no public API change; document that segmentation follows the runtime default locale
- infer nearest `lang` after mount for measured paths
- add `locale?: string | string[]` to text/rich/inline components

The last option is the clearest but expands public API. This should wait for either issue demand or
a focused i18n benchmark showing meaningful differences.

### 7. Improve state styling and accessibility recipes

Priority: low-medium.

Current slot controls make it easy to build toggles, but users still need to wire a11y details
themselves. Potential low-cost improvements:

- docs examples for `aria-expanded` / `aria-controls`
- optional root `data-clamped` / `data-expanded` attributes for styling state
- stronger docs around screen reader behavior for rewritten text

This is not as strategic as SSR or benchmarks, but it improves adoption quality.

## Non-directions for now

- Do not chase `block-ellipsis` / `max-lines` until browsers ship them.
- Do not use native CSS for approximate SSR output.
- Do not make Pretext the final authority for clamp decisions.
- Do not add a public `strategy` prop.
- Do not replace `hiddenItems` with a count-only API.
- Do not assume arbitrary `WrapClamp` `after` content is stable.
- Do not add a locale prop without concrete i18n demand or evidence.

## Source links

- MDN `line-clamp`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp
- MDN CSS overflow: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Overflow
- MDN `text-overflow`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-overflow
- Can I Use `text-overflow: <string>`: https://caniuse.com/mdn-css_properties_text-overflow_string
- MDN `text-wrap`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
- MDN `Intl.Segmenter`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
- MDN `ResizeObserver`: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
- MDN `@media (scripting)`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/scripting
- Vue SSR guide: https://vuejs.org/guide/scaling-up/ssr.html
- Vue async components / lazy hydration: https://vuejs.org/guide/components/async
- Vue `<script setup>` generics / `defineSlots`: https://vuejs.org/api/sfc-script-setup.html
- Vue TypeScript overview: https://vuejs.org/guide/typescript/overview
- Pretext GitHub repository: https://github.com/chenglou/pretext
- NPM download API examples:
  - https://api.npmjs.org/downloads/point/last-week/vue-clamp
  - https://api.npmjs.org/downloads/point/last-week/@chenglou/pretext
- Product feedback examples:
  - https://github.com/Justineo/vue-clamp/issues/101
  - https://github.com/Justineo/vue-clamp/issues/53
  - https://github.com/Justineo/vue-clamp/issues/89
