# Vue Clamp Vue 3 Rebuild

## Context

- The `main` branch started from a fresh Vite+ workspace scaffold and does not contain the old library implementation.
- The migration baseline is the Vue 2 `0.4.1` implementation on `master`.
- The package now ships four Vue 3 clamp surfaces:
  - `LineClamp` for multiline DOM-driven clamping
  - `RichLineClamp` for multiline trusted-inline-html clamping
  - `InlineClamp` for measured one-line affix-friendly truncation
  - `WrapClamp` for wrapped atomic-item clamping
- Solver design vocabulary is centralized in `journey/vocabulary.md`; WrapClamp plans and
  implementation notes should use those terms consistently.
- WrapClamp optimization outcomes and benchmark deltas from the May 2026 solver work are summarized
  in `journey/research/308-wrapclamp-optimization-summary.md`.
- The current post-1.4 forward outlook is summarized in
  `journey/research/309-forward-outlook-research.md`: prioritize SSR / hydration contract design,
  release-visible benchmarks, RichLineClamp development diagnostics, and future experimental work
  such as Pretext acceleration, locale-aware boundaries, and accessibility recipes. The earlier
  WrapClamp generic slot typing opportunity has been addressed by the SFC migration.

## Product Goals

- Ship a Vue 3-only `vue-clamp` package with precise TypeScript types.
- Preserve the `0.4.1` component semantics where they still make sense, while simplifying the public surface:
  - `as`
  - `text`
  - `maxLines`
  - `maxHeight`
  - `ellipsis`
  - `location`
  - `boundary`
  - `expanded`
  - `before` and `after` slots with `{ expand, collapse, toggle, clamped, expanded }`
  - `update:expanded`
  - `clampchange`
  - imperative `expand`, `collapse`, and `toggle`
- Keep the implementation browser-aligned and simple enough to reason about directly from the component file.

## Core Design Decisions

### Package surface

- The root package exports:
  - `LineClamp` as the canonical multiline component name
  - `RichLineClamp` as the canonical multiline rich-html component name
  - `InlineClamp` as the canonical single-line affix-friendly component name
  - `WrapClamp` as the canonical wrapped-item component name
- There is no default export.
- Type declarations follow explicit ownership layers:
  - shared public primitives and private shared type building blocks live in
    `packages/vue-clamp/src/types.ts`
  - component public contracts live next to their component family:
    `line/types.ts`, `rich-line/types.ts`, `inline/types.ts`, and `wrap/types.ts`
  - public types are re-exported only through the root package barrel; those exported names are
    semver API
  - root package type exports are reserved for names users reasonably need to spell when authoring
    app code, render functions, typed slots, wrapper components, refs, or reusable prop callbacks
  - private building-block aliases may be exported from internal source modules for sibling modules
    to assemble public contracts, but they must not be re-exported from the root package barrel
  - shared prop, emit, and slot consistency is enforced with `ClampProps`, `ClampEmits`, and
    `ClampSlots`; component public prop interfaces select only their supported fields instead of
    inheriting from common prop interfaces
  - cross-component internal helper contracts that are not public API should live in the behavior
    module that owns them, such as `text.ts`, `rich.ts`, `native.ts`, and `multiline.ts`; sibling
    modules, tests, and benchmarks may import those contracts directly from the owner module
  - when two components share the same internal algorithm, the shared types belong with that
    algorithm rather than either component; the names should describe the algorithm domain, not a
    component, and they must stay out of the root barrel unless they become package API
  - if a cross-component internal type has no clear behavior-module owner and is genuinely shared,
    it may live in a dedicated top-level internal type module; use this only when a real shared
    owner cannot be identified, and never re-export it from the root package barrel
  - component-family internal contracts shared by files under one component directory live in that
    directory's type-only module, such as `packages/vue-clamp/src/wrap/types.ts`; these modules do
    not import runtime helpers, components, or the package barrel
  - internal type names should use the narrowest useful context: component-family `types.ts` files
    use local names such as `SequenceMeasurement`, while top-level shared internal modules use
    domain names specific enough to avoid ambiguous imports
  - implementation-local solver, DOM, probe, patch, render-state, benchmark-fixture, and website UI
    types stay with the code that owns those states
- Component implementation files do not re-export package declaration types; public package type
  exports stay auditable through component-family `types.ts` files and the root barrel.
- Root package type exports currently include component prop types, slot prop payloads, slot maps,
  exposed-instance types, and user-callback/value-domain contracts:
  - `ClampBoundary`
  - `ClampLength`
  - `LineClampLocation`
  - `LineClampProps`
  - `LineClampSlotProps`
  - `LineClampSlots`
  - `LineClampExposed`
  - `RichLineClampProps`
  - `RichLineClampSlotProps`
  - `RichLineClampSlots`
  - `RichLineClampExposed`
  - `InlineClampParts`
  - `InlineClampSplit`
  - `InlineClampProps`
  - `WrapClampItemKey`
  - `WrapClampItemSlotProps`
  - `WrapClampSlotProps`
  - `WrapClampSlots`
  - `WrapClampExposed`
  - `WrapClampProps`
- Root package type exports intentionally exclude component macro plumbing, emits maps, solver
  state, measurement/probe state, render-state, benchmark fixture, and helper-module internals.
- Component SFCs declare their slot maps with `defineSlots`. Slot maps are public because wrapper
  components and render functions may need to spell the named slot surface directly.
- `WrapClamp` is an SFC using `<script setup lang="ts" generic="T = unknown">` so the item type
  flows from `items` into the `item`, `before`, and `after` slot props.
- `LineClamp`, `RichLineClamp`, and `InlineClamp` are also SFCs. Their component shells use
  `<script setup lang="ts">`, type-based `defineProps`, `defineOptions`, and component-local macro
  declarations. The multiline components use setup-local render functions bound through
  `defineRender(render)`; `InlineClamp` keeps an authored template because its static single-line
  structure benefits from Vue's template compiler output.
- Render-only SFCs with dynamic roots use direct shallow refs for stable measured element nodes and
  function refs only where ref changes need side effects, such as affix wrapper appearance triggering
  a reclamp. The public `as` prop remains a simple `string`; root element typing is not exposed as a
  polymorphic public API because components do not expose the root element and only use generic HTML
  measurement APIs internally.
- SFC macro declarations are the prop/emit source of truth; there are no standalone shared runtime
  prop or emit declaration helper modules.
- Component-local `computed` values are reserved for meaningful reactive boundaries: expensive
  preparation cached across reclamps, template-bound style or slot objects, or derived state that is
  read by multiple reactive consumers. Trivial one-use normalization and boolean aliases should stay
  as plain helper calls so component instances do not carry unnecessary reactive effects.
- `WrapClamp` does not deep-watch arbitrary item payloads. It observes item sequence changes by
  array reference and length, while item slot size changes are handled by the existing DOM
  observation path and same-flush Vue update invalidation.
- Plain boolean props rely on Vue's boolean prop casting instead of explicit `default: false`.
- `expanded` is a controlled state model, so each SFC declares it with
  `defineModel(..., { default: false })`; `undefined` is normalized to `false` at the model boundary
  and downstream internals receive `Ref<boolean>`.
- `expanded` `defineModel` refs are the source of truth for expansion state. Shared shells may
  receive that model ref directly, but they do not maintain a second expanded ref.
- `WrapClamp` uses Vue macro declarations for the component shell:
  `defineProps` with reactive destructuring defaults, `defineModel` for `expanded`, `defineEmits`
  for `clampchange`, `defineSlots`, `defineExpose`, and `defineOptions`.
- `WrapClamp` uses the public `WrapClampProps<T>` and `WrapClampSlots<T>` contracts directly in the
  SFC macro declarations. The props macro uses `Omit<WrapClampProps<T>, "expanded">` because
  `expanded` is declared through `defineModel`.
- `LineClamp`, `RichLineClamp`, and `WrapClamp` intentionally have no authored `<template>` block.
  Each remains the macro and type surface, while a setup-local `render()` function is the runtime
  render entry. `WrapClamp` delegates root/content/item structure to `wrap/render.ts`; `LineClamp`
  and `RichLineClamp` assemble affix wrappers only when the corresponding slot exists and produces
  content.
- Render-only component SFCs bind their setup-local render entry through Vue Macros
  `defineRender(render)`. This keeps render-only SFC sources explicit without carrying local
  marker-template plugins or a custom template compiler.
- `@vue-macros/define-render` is a build-time dependency only. The package runtime output contains
  the returned render function and does not expose Vue Macros as public API.
- The package now requires Vue `^3.5.0` because `WrapClamp` depends on the modern SFC macro and
  reactive props destructuring toolchain.
- `vp pack` builds Vue SFCs through `unplugin-vue/rolldown` and declaration generation through
  `dts: { vue: true }` / `vue-tsc`; the package follows tsdown's neutral-platform default output
  extensions, so the root export points to `dist/index.js` and `dist/index.d.ts`.
- `ClampControls`, `ClampState`, `ClampSlotProps`, and `ClampExposed` are private building blocks in
  `types.ts`; they keep concrete public contracts aligned without creating a generic cross-component
  public abstraction and are not root package exports.
- `ClampProps`, `ClampEmits`, and `ClampSlots` are private shared maps in `types.ts`; component
  contracts colocated in component directories select from those maps with `Pick` or extension, and
  the root package does not export the shared maps.
- SFC shells use type-based `defineEmits` declarations without runtime validators; TypeScript
  payload precision is preserved through `ClampEmits` and type-surface tests.
- `TextClampSpacing`, `PreparedText`, `TextClampHint`, `TextClampResult`, `TextClampFitInput`, and
  `TextClampLayoutInput` are text-helper contracts owned by `text.ts`; they are intentionally not
  root package exports.
- `MultilineFrameRefs`, `MultilineAffixRefSetter`, `MultilineShellOptions`, and `MultilineShell`
  are multiline shell contracts owned by `multiline.ts`; they are intentionally not root package
  exports.
- `RichBoundaryPoint`, `PreparedRichTextNode`, `PreparedRichElementNode`, `PreparedRichNode`,
  `PreparedRich`, `RichState`, `RichClampProbe`, `RichClampOptions`, and `RichClampResult` are
  rich-helper contracts owned by `rich.ts`; they are intentionally not root package exports.
- Helper snapshot types should be readonly where callers are not meant to mutate prepared state,
  warm-start hints, or clamp results.
- Do not create shared types only because two objects have the same shape; `RichState`,
  `TextClampResult`, native mode state, and `WrapClamp` sequence/flow states are intentionally
  separate concepts.
- `LineClamp` is the text-only multiline component.
- `RichLineClamp` is the rich-html multiline component.
- `LineClamp` `location` accepts the keyword aliases `start`, `middle`, and `end`, plus numeric ratios from `0` to `1`.
- `LineClamp`, `RichLineClamp`, and `InlineClamp` accept `boundary: "grapheme" | "word"`.
- `boundary` defaults to `"grapheme"` for backwards compatibility and maximum fit. `"word"`
  chooses word-level clamp candidates and falls back to grapheme candidates only when no whole-word
  candidate fits.
- `RichLineClamp` is end-truncation-only and does not carry `location`.
- `LineClamp` `before` and `after` remain rich Vue slots.
- `RichLineClamp` keeps the same `before` / `after` slot contract and exposed expand/collapse
  controls.
- Empty `before` / `after` slot output is filtered at the VNode level so empty arrays, comment-only results, and whitespace-only text do not leave wrapper elements behind.
- Stable internal styling hooks use `data-part` only:
  - `LineClamp`: `root`, `content`, `before`, `body`, `after`
  - `RichLineClamp`: `root`, `content`, `before`, `body`, `after`
  - `InlineClamp`: `root`, `start`, `body`, `end`
  - `WrapClamp`: `root`, `content`, `before`, `item`, `after`
- DOM nesting is intentionally not part of the styling contract.
- `InlineClamp` is single-line-only and uses live DOM measurement instead of native
  `text-overflow`.
- `InlineClamp` accepts:
  - `text`
  - `ellipsis`
  - `location`
  - `boundary`
  - optional `split(text) => { start?, body, end? }`
  - `as`
- `WrapClamp` accepts:
  - `items`
  - optional `itemKey`
  - `maxLines`
  - `maxHeight`
  - `expanded`
  - `as`
- `WrapClamp` exposes:
  - `item` slot for visible item rendering
  - `before` / `after` slots with `{ expand, collapse, toggle, clamped, expanded, hiddenItems }`
  - `update:expanded`
  - `clampchange`
  - imperative `expand`, `collapse`, and `toggle`
- `WrapClamp` requires the `item` slot for item rendering. It does not provide default text
  rendering for any item shape.

### Runtime model

- `LineClamp` is DOM-driven and browser-aligned.
- The multiline architecture is now:
  - `LineClamp` for text
  - `RichLineClamp` for trusted inline rich text
- The remaining nontrivial helper modules for multiline clamping are:
  - `packages/vue-clamp/src/multiline.ts` for the small shared multiline shell:
    expanded/clamped state, exposed actions, queued recomputes, `ResizeObserver`, font-load
    invalidation, and same-flush `onUpdated` invalidation
  - `packages/vue-clamp/src/text.ts` for grapheme/word boundary preparation, kept-count text
    generation, text clamp search, and location normalization
  - `packages/vue-clamp/src/native.ts` for the narrow native CSS text-clamp subset:
    eligibility checks, native styles, CSS support detection, and native overflow reads
  - `packages/vue-clamp/src/rich.ts` for rich-text parsing, runtime inline-flow classification,
    logical-run preprocessing, boundary slicing, and rich clamp search
  - `packages/vue-clamp/src/multiline-render.ts` for the Line/Rich filtered affix-slot wrapper
  - `packages/vue-clamp/src/multiline-styles.ts` for Line/Rich shared static slot box styles
  - `packages/vue-clamp/src/styles.ts` for shared internal static styles, currently the visually
    hidden source-text style used by accessible rewritten output
  - `packages/vue-clamp/src/wrap/flow.ts` for WrapClamp's low-context DOM sequence measurement,
    static flow estimation, item-shell display toggling, and measured-width helpers
  - `packages/vue-clamp/src/wrap/render.ts` for WrapClamp's small render-only helpers: item key
    resolution, filtered affix-slot rendering, and root/content/item rendering used by the
    WrapClamp hot path
  - `packages/vue-clamp/src/wrap/types.ts` for WrapClamp-only internal contracts shared by the SFC
    and `wrap/*` helpers, using local names because the `wrap/` path provides component context
  - `packages/vue-clamp/src/{inline,rich-line,wrap}/styles.ts` for component-family static style
    contracts that affect measurement or hidden probe behavior
  - `packages/vue-clamp/src/layout.ts` for the remaining shared primitives worth centralizing:
    line-limit normalization, CSS length normalization, subpixel border-box signatures,
    ResizeObserver entry-signature comparison, and fit checks
- `packages/vue-clamp/src/line/LineClamp.vue` now owns only text behavior:
  - a shallow visible-text snapshot that lets measured clamped-to-clamped passes patch text DOM
    directly without forcing a Vue render, while still re-rendering when the accessibility structure
    or clamped state changes
  - text preparation and native one-line fast path dispatch
  - text accessibility handling for rewritten visible output
  - guarded measured-path reuse of the last text clamp result and root width so warm resize passes
    can skip the full-text fit probe only when the previous result was clamped, the prepared
    boundary offsets still match, and the root has not grown beyond the small local search window
- `packages/vue-clamp/src/rich-line/RichLineClamp.vue` now owns only rich-html behavior:
  - visible/probe rich DOM decisions and rich fallback state
  - hidden probe setup for rich measurement
  - the visible rich HTML is patched directly into the shared `body` part
  - persistent hidden-probe scaffolding, including a stable content/body pair and cached cloned
    affix boxes keyed by source wrapper identity plus measured geometry signature
  - no image-load settlement; inline rich images must provide stable layout dimensions up front
- Shared code stays in small helpers instead of a large base shell.
- Internal helper contracts use named input objects once a call would otherwise require several
  same-shaped positional values, especially DOM elements and warm-start hints.
- `LineClamp` and `RichLineClamp` now share one narrow internal shell helper rather than
  duplicating the same lifecycle shell:
  - root/content/body/before/after refs
  - shell-provided shared affix ref setters that normalize Vue ref payloads to
    `HTMLElement | null`, ignore unchanged wrapper refs, and schedule the follow-up reclamp after
    Vue commits filtered slot DOM
  - shared affix slot-control payload creation for before/after slots
  - controlled `expanded` syncing and `clamped` emission
  - queued recomputes
  - resize/font invalidation
  - same-flush `onUpdated` invalidation
  - recompute callbacks receive the shared expanded ref plus an optional root-width snapshot when
    the shell already measured one; component-specific refs remain local to each component closure
  - the actual clamp logic still stays local to each component
  - the shell observes root/content/before/after border-box changes; the body ref stays available
    to components, but content already captures body geometry for shell invalidation
  - Line/Rich layout signatures use subpixel border-box measurements rather than integer
    `offsetWidth` / `offsetHeight`, because fractional width changes can affect text wrapping
  - those subpixel signatures are quantized to 1/1000 CSS px keys to avoid float-string formatting
    while preserving fractional-size sensitivity
  - browser layout tests guard this precision boundary by changing a box between two fractional
    widths with the same integer `offsetWidth` and requiring the direct border-box width read,
    synchronous border-box signature, synchronous width snapshot, ResizeObserver entry comparison,
    ordinary ResizeObserver width snapshot, and transformed visual ResizeObserver fallback snapshot
    to preserve the subpixel change
  - ResizeObserver callbacks observe the border box and compare reported subpixel border-box sizes
    for the signature elements against the last synchronous layout signature, so settled
    self-notifications do not need fresh layout reads while external container and slot-size changes
    still schedule reclamps
  - Line/Rich ResizeObserver handling uses entry border-box snapshots for ordinary horizontal
    layout, and falls back to visual `getBoundingClientRect()` snapshots only when transformed
    ancestors or vertical/sideways writing modes make entry inline/block sizes incomparable with the
    stored visual signatures
  - ResizeObserver entries refresh the shell's cached border-box signatures before scheduling a
    reclamp; RichLineClamp reuses those observed affix signatures for hidden-probe clone validation
    instead of rereading affix wrapper bounding rects on every width-only pass
  - when RichLineClamp pre-reads affix signatures for a root-size change and the recompute does not
    change the public `clamped` slot prop, the settled layout signature reuses those affix
    signatures; clamped/full transitions still reread affix boxes after Vue has committed slot prop
    changes
  - when `onUpdated` or a root ResizeObserver entry already provides the current subpixel root
    width, the shell passes that width into Line/Rich recompute callbacks so the clamp pass does not
    reread the same root bounding rect; recompute paths without a fresh snapshot still measure the
    root directly
  - font-load invalidation is coalesced at the multiline shell: a font event schedules a font-only
    reclamp for the next animation frame, but if a width, prop, slot, or ResizeObserver reclamp has
    already run before then, the delayed font-only reclamp is skipped because that pass measured the
    current font metrics. Font-only changes still reclamp on the next frame.
  - the shared coalescing runner serializes recomputes while preserving a follow-up request made
    during an active clamp pass; `packages/vue-clamp/tests/layout.test.ts` guards that multiple
    requests during a running task become one later pass and never run concurrently
  - max-height-only fit checks compare the content bounding box with the root's visible bounds
    instead of materializing inline fragment lists. The visible-bounds cache is keyed by the root
    `clientHeight`; browser tests cover centered and bottom-anchored layouts where candidate height
    changes move the root during one search pass.
  - LineClamp affix line-limit checks keep the near-boundary exact rect-list verification needed
    for correctness, but once exact verification proves a content height overflows for the same line
    limit, later candidates at that height or above reject from the cached height. The overflow
    cache is cleared whenever exact rects reveal a larger single-line box height, so a changed line
    metric cannot keep using an older reject threshold.
  - for Line/Rich updates where the root border-box signature changed, the shell schedules the
    same-flush reclamp from the root snapshot and defers content signature refresh to the
    post-recompute settled snapshot; RichLineClamp opts into same-flush affix signature refresh
    because its hidden-probe clone cache validates affix boxes, while LineClamp does not need those
    affix signatures before recompute
- `LineClamp` native clamping is represented internally as single-line versus multi-line modes
  rather than a boolean or CSS-mechanism-specific strings:
  - `"single-line"` for the exact one-line end/grapheme/default-ellipsis subset
  - `"multi-line"` for the exact multiline end/grapheme/default-ellipsis subset when `maxHeight`
    and `after` are absent and browser support is present
  - `null` for measured DOM clamping
- Native CSS clamp eligibility and style details stay outside `LineClamp.vue`; the component only
  resolves the mode for the current render/recompute and applies the resulting text state.
- Native LineClamp overflow measurement avoids extra root `getBoundingClientRect()` reads. Native
  multiline may receive the shell's fresh subpixel root width as an additional unmeasurable-layout
  guard, but the content element's own `clientWidth` must still be positive before scroll height is
  trusted; root padding or external width snapshots cannot make a zero-width content box measurable.
  Native single-line still reads the text cell's own client width because affix slots can make it
  narrower than the root.
- Native multiline content styles are cached per normalized line limit so repeated native width
  sweeps keep stable style object identity instead of asking Vue to diff an equivalent freshly
  allocated style object on every render.
- Multiline native `line-clamp` allows `before` slot content because it is a prefix inside the same
  formatting context. It excludes `after` slot content because native CSS cannot reserve suffix
  space while clamping the body.
- `InlineClamp` is a small measured single-line component:
  - one `inline-block` root that clips to its available width
  - optional fixed `start` and `end` segments in normal inline flow
  - one rewritten `body` segment found by boundary-aware binary search against the live inline
    content
  - `location` shares the `LineClamp` keyword/ratio semantics and applies only inside the
    rewritten `body`; split `start` and `end` segments remain fixed
  - content-sized clamp passes restore the full body text before reading the root width, so a
    previously shortened inline-block root does not become the stale width limit when the parent
    grows; when the root has an inline content-independent `width`, warm clamped passes can trust
    the current subpixel border-box width and avoid that extra full-body mutation
  - when a Vue-driven style update already read the root's subpixel border-box width for layout
    invalidation, InlineClamp passes that width into the same recompute pass and skips the duplicate
    root bounding-rect read only for content-independent root widths. Content-sized and percentage
    layouts still restore the full body and measure after that restore.
  - for those same content-independent root widths, InlineClamp also reuses the `onUpdated`
    parent/root size signature as the settled post-recompute signature. Rewriting the body cannot
    change a fixed-width one-line inline-block's border box, while requests without such a fresh
    snapshot, such as font or ResizeObserver invalidation, still force a post-recompute signature
    read.
  - percentage root widths are treated as content-dependent even when written inline, because a
    shrink-to-fit ancestor can make the current truncated body text determine the measured width;
    font-load or external recompute events must therefore restore the full body before measuring
  - inline root widths that reference CSS variables are also treated as unresolved rather than
    content-independent, because `calc(var(...))` can hide a percentage width from the string-level
    guard while still resolving against a shrink-to-fit ancestor
  - custom `ellipsis` is inserted by JS, so the rewritten body can shrink to only the ellipsis
  - segment text stays in normal inline flow, so spaces follow standard browser whitespace
    collapsing instead of a component-specific preservation path
  - clamp search writes the final body text into the live DOM node, and a shallow visible-body
    snapshot triggers Vue only when the hidden full-text accessibility structure must appear or
    disappear; clamped-to-clamped width churn therefore avoids a second Vue text patch
  - warm clamped resize passes use the shared text rank-cost policy rather than a fixed pixel
    window before skipping the separate full-body `scrollWidth` probe. The inline path models a
    one-line text clamp with preserved outer body spacing, so the same warm/cold probe comparison
    used by `LineClamp` decides whether the full body should be part of the search instead of a
    preliminary read.
  - the full body still participates as a candidate inside that warm search, and growing passes may
    skip the final bare-full verification only when the new width is no wider than a previously
    observed clamped width for the same boundary offsets, ellipsis, normalized clamp ratio, spacing,
    and single-line capacity. Same-width passes still verify because font or layout metrics can
    change without a width change.
  - inline candidate probes route body text writes through a small local guard, matching the shared
    text helper's behavior and avoiding no-op `textContent` mutations when the current candidate is
    already rendered
  - for fixed-width roots whose text metrics are declared directly on the root inline style,
    InlineClamp keeps a tiny exact-result cache keyed by the parent/root layout signature plus root
    class/style attributes. The cache is intentionally narrow: non-empty root classes, percentage or
    CSS-variable widths, unresolved `%` or `var(...)` references in inline text-width declarations,
    missing inline font metrics, font-load invalidations, and ResizeObserver invalidations all
    bypass or clear it. It only targets repeated exact-width Vue style churn; novel widths still run
    the normal measured search. Exact-result cache keys are tuple-encoded rather than
    delimiter-joined so attribute or stylesheet text cannot blur field boundaries. The shared
    content-independent-width gate is covered by
    `packages/vue-clamp/tests/layout.test.ts`: absolute numeric/calc/clamp widths are accepted,
    while percentage and CSS-variable widths are rejected so shrink-to-fit content cannot become its
    own stale width limit. The same test file guards the inline-font-metrics gate: exact-result
    caches require either a direct `font` declaration or both `font-family` and `font-size` on the
    root inline style, and those metric declarations must not contain unresolved `%` or `var(...)`
    references. The same helper rejects unresolved `letter-spacing` / word-spacing / font longhand
    declarations that can change one-line text width, but it does not reject unrelated declarations
    such as the component-owned `max-width:100%`.
  - root-width snapshots and exact-result cache entries share the same freshness boundary: only
    same-flush Vue layout snapshots may carry a pending root width into `clampBody`; font,
    ResizeObserver, mount, and semantic invalidations clear both the pending width and cache so a
    stale width cannot survive after the cache has been invalidated
  - `ResizeObserver` and font-load invalidation keep the measured result current
  - parent/root layout invalidation uses subpixel border-box signatures, and ResizeObserver
    callbacks compare `borderBoxSize` entries against the last settled signature so fractional
    width changes are not lost to integer offset rounding
  - when a generic `ResizeObserver` entry is not geometrically comparable to the stored visual
    signature because of transformed ancestors or logical writing-mode axes, the shared layout
    helper falls back to a visual border-box signature only for that element; only positive
    fallback decisions are cached because ancestor transforms and writing modes can appear
    dynamically after an earlier ordinary comparison
  - width-only reclamps reuse the shared boundary-aware warm-start search helper
  - no slots or exposed instance API
- `WrapClamp` is item-driven and browser-aligned:
  - one root clamp container with live DOM measurement
  - one normal horizontal inline-flex wrapping flow of atomic item shells
  - optional `before` / `after` atomic slot shells
  - internal measurement and flow-estimation contracts use physical `width` / `height` naming
    because vertical writing mode is intentionally outside the supported contract
  - reactive `visibleCount`, `expanded`, and `isClamped`
  - no public strategy prop or cache-backed variant
  - no partial clipping inside an item
  - the SFC owns Vue macros, refs, watchers, exposed methods, and the main recompute state machine;
    extracted `wrap/*` helpers must stay low-context and should not grow into a composable carrying
    component refs, props, slots, and lifecycle state
  - `[data-part="content"]` is a layout-critical shell, not an arbitrary styling container:
    - supported user-facing geometry styles are `gap`, `row-gap`, `column-gap`, and normal
      horizontal flex-line `align-items` values such as `flex-start`, `stretch`, `center`,
      `flex-end`, and `baseline`
    - the solver identifies rows by vertical box overlap, so mixed-height items remain on the
      same measured row under center/end/baseline alignment
    - structural overrides such as `display`, `flex-wrap`, `flex-direction`, `writing-mode`,
      padding/border/explicit content width, transforms, positioning, `order`, and
      `content-visibility` are outside the supported contract

### Accessibility model

- The component no longer relies on `role="text"` or `aria-label` on a generic span.
- When the visible text is not rewritten, the full source text stays directly in the visible DOM.
- When the visible text is rewritten by the JS clamp path, the component:
  - marks the rewritten visible text node as `aria-hidden`
  - renders a visually hidden full-text sibling in the same text position for assistive tech
- This keeps the accessible text aligned with the unclamped source without hiding `before` and `after` slot content.
- `RichLineClamp` keeps only the visible rich tree in the accessibility tree:
  - its hidden probe tree is `aria-hidden` and exists only for measurement
  - expanded mode is the path to the full visible rich content

### Clamp strategy

- The text clamp pass in `LineClamp`:
  - starts from the `text` prop
  - normalizes `location` to an internal ratio before clamp rendering
  - prepares clamp boundary offsets once per source text and reuses them across width/slot/font
    reclamps
  - measures the live content width from the rendered root
  - passes that measured root width into the text layout helper, so helper-level direct probes do
    not perform their own root bounding-rect read
  - normalizes `maxLines` and `maxHeight`
  - refreshes the visible root clip box during each `maxHeight` fit probe so reactive height
    increases can expand the visible text correctly. A pass-local visible-bounds cache may reuse the
    root `clientTop` value, but it still rereads the root visual top whenever candidate height
    changes, so centered or bottom-anchored roots cannot reuse a stale visible window.
  - uses a native CSS overflow fast path for the collapsed single-line end case when `boundary` is
    `"grapheme"`, the default `…` ellipsis is used, and the normalized location ratio is `1`
  - in that native path, `before` and `after` stay as fixed inline-flex items while the text cell becomes the only flexible width consumer
  - otherwise binary-searches the kept boundary count directly against the live DOM
  - non-native text searches with a concrete `maxLines` limit and without `maxHeight` can use the
    same simple line-height fit predicate as RichLineClamp: when the current text style has roomy
    line metrics and no affix, candidate height is compared with `maxLines * lineHeight` and the
    pass avoids materializing the full `getClientRects()` list from the first probe. Tight font
    metrics do one exact rect-list count first, then reuse the observed line-box height for later
    candidates in the same pass; mixed glyph/fallback-font browser tests keep that calibrated
    predicate equivalent to exact line counting. Affix-bearing searches also force that first exact
    calibration because before/after inline boxes can be taller than the text line-height. When an
    affix-calibrated height check says a candidate is just over the line limit, LineClamp verifies
    with exact rect line counting before rejecting it; a demo-page regression showed that otherwise
    narrow after-slot layouts can get stuck at a two-line prefix even when a three-line candidate
    fits. Candidates that are clearly at least one extra line over the limit still use the cheap
    height rejection. `maxHeight` still uses visible-bounds checks.
  - width-only reclamps warm-start from the last kept boundary count when the prepared boundary
    offsets still match, then do a bounded local expansion before binary searching, so continuous
    resize does not always restart from the middle of the whole text while large jumps stay close to
    cold-search cost
  - width jumps decide warm hint reuse from estimated search work rather than from a global pixel
    threshold: the helper estimates the target rank from an observed rank-per-pixel slope, falling
    back to visible-rank density (`kept / rootWidth`) when no measured slope exists, then compares
    estimated warm probes against the cold binary-search probe upper bound because the estimated
    target rank is not guaranteed to be the true browser layout boundary. The same estimate feeds
    both warm hint reuse and guarded full-fit skipping, so future threshold changes keep one shared
    meaning across LineClamp and InlineClamp instead of drifting between call sites.
  - the warm estimate is allowed a bounded `+2` probe budget over cold only when that extra budget
    has a layout reason: the predicted rank movement is still inside the warm-search local coverage;
    or, for larger movements, word-boundary text has more than one visible line; or non-word text
    has fixed affix occupancy, at least two visible lines, and a guarded full-fit skip so the DOM
    still starts from the previous clamped text. Otherwise the warm path must prove `warm < cold`;
    this keeps single-line coarse-word grows, no-affix dense grapheme text, and full-text-reset
    non-word searches from spending a patch-locality budget they do not reliably earn.
  - dynamic rank extrapolation is used only when the current and previous widths are still in the
    same scale band and the estimated rank movement is no larger than the cold search depth; very
    large width jumps fall back to cold search because the old rank no longer describes the current
    wrapping regime
  - displayed line count is part of the width-to-rank relationship: more lines usually mean the same
    width change can add or remove more candidates, so dynamic reuse records positive
    rank-per-pixel slopes from the current line limit and text shape instead of treating the pixel
    threshold as globally meaningful; measured text layout hints carry the line limit that produced
    them, and semantic line-limit changes invalidate warm hint reuse and guarded full-fit skips even
    for direct helper callers
  - `maxHeight`-only text clamps can also provide a measured-line-capacity hint when the configured
    max height is a number or `px` length and the computed line height resolves to pixels. That
    value is used only for warm-search risk budgeting and hint identity; final acceptance still
    comes from live browser `maxHeight` fitting. Resolving arbitrary CSS lengths such as `em` or
    `calc(...)` into this hint was tested and rejected because it increased total direct-helper work
    in the covered non-px max-height matrix.
  - measured text layout hints also carry the active ellipsis, clamp ratio, spacing mode,
    line capacity, `maxHeight` value, and an affix layout key built from observed before/after slot
    box signatures; same text and same root width are not enough to reuse a rank hint when candidate
    rendering, whitespace handling, vertical clipping, or fixed slot occupancy changed. Fixed affix
    occupancy also affects the warm/cold trade-off, so affix-bearing non-word clamps may spend the
    bounded patch-locality budget once at least two visible lines are available and the full-source
    fit probe can be skipped; no-affix dense grapheme clamps and non-word searches after a full-text
    reset still must prove the warm path by probe count.
  - a hard `maxLines * warmCoverage` density gate was rejected because it discarded safe one-line
    plateau wins in the input-space matrix; the retained guard uses line-limit-specific observed
    rank density and an explicit warm-versus-cold probe estimate instead
  - line count is therefore a slope input rather than an independent optimization switch: `maxLines=5`
    tends to make a width jump move more boundary ranks than `maxLines=1`, but the final warm/cold
    choice still depends on candidate granularity, previous rank position, affix occupancy, and the
    exact estimated probe count
  - the warm-search expansion window itself stays an algorithm budget, not a line-count formula:
    line count changes the predicted target rank and warm/cold probe comparison, while the local
    expansion window describes how far the warm search can prove locality before falling back to
    binary search. The default text window remains two local expansions; LineClamp word-boundary
    layout search spends one additional expansion because whole-word candidates are coarser and the
    expanded input-space matrix proved lower browser work without any non-word structural change.
    The search probe-count model is covered in `packages/vue-clamp/tests/search.test.ts`, where
    estimated warm/cold probe counts are checked against the actual `findLastFittingIndex` probe
    order across candidate counts, every finite target rank from `-1` through `count`, non-finite
    target boundaries, hints, and expansion budgets. The same test file also protects
    `findLargestFittingCount`, including its no-hint ceil-midpoint probe order, hinted count warm
    start, and known-safe lower-bound fallback used by WrapClamp materialized/live count searches.
  - positive-slope extrapolation is limited to the width scale where that slope was observed, and
    only when the estimated rank movement is small enough relative to cold search depth; this keeps
    high-line-count dense text and very large jumps from overusing stale hints
  - measured text results carry the root width that produced them, so later layout passes can ignore
    a stale warm hint after large width jumps without the component keeping a parallel width cache
  - `clampTextToLayout` owns the normal full-source skip decision from the same context it uses for
    text hint identity; `LineClamp` passes affix, line-capacity, limit, and max-height inputs once
    instead of separately reconstructing that internal context. Direct helper tests that need the
    guarded skip path use the explicit `forceSkipFullFit` input.
  - warm resize passes that are still clearly clamped may skip the separate full-source fit probe
    and let the candidate search include the full-source candidate instead; shrinking widths are
    monotonic, so a previous clamped result proves the full source still cannot fit at the smaller
    width. Same-width passes must still verify the full-source candidate before returning a
    clamped result, because font or layout metric changes can make the source fit without changing
    the root width. Growing passes may skip that final full-source verification only when the new
    width is no wider than a previously observed clamped width under the same text, ellipsis,
    ratio, spacing, line limit, max-height, and affix layout key. A width where the full source
    fitted never counts as such proof.
  - when `boundary="word"` previously fell back to grapheme cuts, later narrower widths can
    warm-start directly in the grapheme fallback search. A narrower container cannot make a whole
    word candidate that previously failed start fitting, so the primary word search would only
    re-prove failure before reaching the same fallback path. Same-width and growing passes still
    try word candidates first to preserve word-boundary preference under font changes and recovery
    to wider layouts.
  - word-boundary grapheme fallback results also record the widest same-context width where the
    browser has proved no word candidate fits. Later growing passes may skip the primary word
    search while they remain inside that proved width and search grapheme cuts directly; same-width
    recomputes deliberately drop the wider proof so font or layout metric changes can re-test word
    candidates.
  - measured clamped-to-clamped commits leave the final text mutation from the search pass in place
    and update only a non-triggering shallow snapshot, so width churn does not call affix slots or
    patch the component tree again unless the hidden-source accessibility wrapper or clamped slot
    state must change
  - text-only candidate writes update an existing sole text node through `Text.data` when that DOM
    shape is present, falling back to `textContent` only when the target has a different child
    structure. This does not reduce the number of candidate text writes, but it turns most measured
    text rewrites from child-list node replacement into character-data mutation and avoids repeated
    text-node allocation/removal in LineClamp and InlineClamp hot paths.
  - text and rich fit probes can use a rect-count shortcut when only `maxLines` is active: if the
    content fragment count is already no larger than the line limit, the candidate fits without
    allocating and comparing grouped line boxes
  - LineClamp may reuse a previously calibrated simple-line fit only when the text style key and
    before/after affix layout key are unchanged. The cache preserves the exact line-box height
    learned from the first rect-list pass, but it does not cache clamp results or skip computed
    style reads; font load notifications clear the cache before the next reclamp.
  - max-height-only fit probes compare the content bounding box with the root's visible bounds
    instead of materializing every inline fragment: if the union box is inside the clipped root,
    every child rect is inside it as well. Probes that also have a line limit still use exact
    `getClientRects()` grouping because they must count visual lines.
  - `maxHeight` fit probes cache the root's visible bounds only while the root `clientHeight` stays
    unchanged inside one clamp pass. Candidate text changes can change root height and move the root
    inside centered or anchored parents, so a changed height forces a fresh visible top/bottom read;
    stable-height candidates reuse the last bounds and avoid duplicate root rect/client-top reads.
  - fit probes avoid collecting all line rects when an early max-height or line-count failure is
    already known
- The rich clamp pass in `RichLineClamp`:
  - only end truncation is supported
  - support is behavior-based rather than tag-name-based:
    - any node can participate if the runtime can clone it back into the DOM and its rendered
      layout stays in inline flow
    - leaf elements without light DOM content are treated as atomic inline units, including custom
      elements
    - descendants with child content are searched only when they render as transparent inline
      wrappers (`display: inline` or `display: contents`)
    - inline formatting contexts such as `inline-block` or `inline-flex` are treated as atomic runs
      rather than searchable wrapper text
  - explicit special handling remains for `br`, `wbr`, atomic `img`, and outer `svg`
  - rendered layout that leaves inline flow, or structural/computed-layout violations such as
    positioned or floated descendants, falls back to the original HTML unchanged
  - search is now boundary-oriented:
    - first binary-search the ends of logical runs
    - then refine inside only the next text run using the configured text boundary
    - candidate output is generated from structural boundary decisions instead of serialized HTML
    - clamped rich output appends the ellipsis as a plain text node at the `body` root, even when
      the truncation point is inside an inline element such as `code`, `strong`, or `a`
    - parsed rich preprocessing prepares text boundary metadata once per parsed source instance and
      reuses it across width, slot, and font reclamps for that instance
    - rich preparation no longer carries its own support flag; support is decided only from the
      rendered layout at clamp time
    - rendered-layout inspection happens before accepting an unclamped rich result, because
      unsupported descendants such as floats and out-of-flow boxes must fall back to raw HTML even
      when the current full tree appears to fit
    - fit probes now patch a persistent hidden probe tree instead of mutating the visible rich body
    - the hidden probe keeps its root/content/body structure mounted across candidates and
      reclamps, and only rebuilds the content child list when affix presence or clone identity
      changes
    - the component sizes the hidden probe from a subpixel visible-root width, reusing the
      multiline shell's fresh root snapshot when available and measuring directly otherwise, so
      fractional root widths do not get rounded before rich measurement
    - the probe snapshot includes the measured width, so `clampRich` can reject unmeasurable probes
      without reading the probe root bounding rect
    - probe affix clones are reused while both the slot wrapper identity and measured size signature
      stay stable; size changes intentionally invalidate the clone, while same-size slot-content
      changes can keep the old hidden clone because rich fit only depends on the affix box
    - affix clone signatures come from the multiline shell's observed subpixel border-box cache, so
      stable affix boxes do not require a fresh synchronous bounding-rect read during each probe
      rebuild
    - warm resize passes that were already clamped may skip the separate full-rich fit probe when
      the probe width has not grown beyond the local-search window; the coarse search then includes
      the full state as a candidate so small grows can still recover the unclamped source
    - skipped full-rich probes are a cost shortcut only, not a correctness shortcut: same-width
      clamped results verify the bare full tree before returning a clamped state when the search did
      not already test it. This is required because a clamped candidate with trimmed trailing
      whitespace plus an ellipsis can fit while the full rich text with preserved trailing
      whitespace does not. Shrinking passes rely on monotonic width proof, while growing passes may
      skip that final full-state verification only when the new width is no wider than a previously
      observed clamped width under the same rich source, clamp constraints, and affix signature.
    - Rich warm search hints and guarded full-fit skips require the current hidden-probe affix
      signature to match the state that produced the hint; a root width alone is not a complete
      layout identity when before/after slot boxes reserve inline space
    - rich candidate checks share the text helper's conservative rect-count fit shortcut when
      `maxHeight` is absent; `maxHeight` still uses visible-bounds checks, with the same
      stable-client-height bounds reuse as text clamps
    - simple inline-rich line-limit probes can avoid `getClientRects()` entirely by comparing the
      content bounding height with the current line height times `maxLines`. This path is limited to
      no-affix, no-`maxHeight`, all-text logical runs whose current rendered layout still consists
      of transparent inline wrappers with matching font size, line height, and baseline alignment.
      The probe rechecks the current DOM layout even when the logical-run search index is cached,
      because child font metrics can change without changing the trusted HTML source.
    - height-based rich line counting starts immediately when the current font size is comfortably
      below line height. When browser inline text rects are taller than CSS `line-height`, the pass
      first measures exact rects and then calibrates the per-line box height for later same-pass
      candidates; the cached search index is still rechecked against current DOM font metrics.
    - width-only visible commits patch a prefix-preserving suffix from the prepared source instead
      of using `innerHTML`
    - structural patches clone only the changed suffix under the shared patch anchor, so unchanged
      prefix descendants such as images are not recreated during width-only reclamps
    - when a clamped rich state grows from a boundary that already includes a complete source
      subtree, the patcher appends only the newly visible source fragment and preserves the live
      prefix nodes instead of deleting and rebuilding them
    - that complete-prefix grow path also covers recovery from clamped output to full rich output,
      but only when the clamped prefix is byte-for-byte present in the live DOM. If the source
      prefix ends in whitespace or a trailing `wbr`, the clamped render may have trimmed that source
      content before adding the root ellipsis, so the patcher falls back to the generic rebuild path
      to restore the source prefix before appending later content.
    - when a clamped rich state grows from the middle of a source text node to a later source
      boundary, the patcher first restores that live text node to the full source text, then appends
      only the newly visible suffix. This preserves the existing prefix wrapper and text node in
      metadata/affix rows where growing across sibling inline wrappers would otherwise fall back to
      a root-level generic rebuild.
    - when a clamped rich state shrinks to an earlier complete source-prefix boundary, the patcher
      removes only the live DOM suffix and re-appends the root ellipsis. This preserves the already
      visible prefix nodes and reduces mutation work without changing any measurement decisions.
    - when a structural rich patch moves between two clamped cuts in the same source text node, the
      live text node is updated in place instead of rebuilding the same suffix. The same-node path
      trims trailing whitespace before the root-level ellipsis, matching the generic structural
      patch semantics while avoiding child-list churn on word-boundary cuts that land after a space;
      it skips the text write when trimming leaves the live text unchanged, and is guarded so the
      root-level ellipsis appended by the clamp algorithm is never mistaken for a source text node
    - generic clamped-to-clamped rich patches also preserve the existing root-level ellipsis and
      insert the rebuilt source fragment before it when the patch anchor is the rich body root. This
      keeps the ellipsis outside the source tree while avoiding one root text-node removal and
      recreation for every cross-node reclamp.
    - full-to-clamped rich patches trim the existing full DOM down to the target source boundary
      and append the root ellipsis instead of deleting the visible prefix and cloning it back from
      the prepared source. This preserves prefix wrapper/text node identity during probe and visible
      transitions from an accepted full candidate back to a clamped candidate; whitespace-sensitive
      cuts still use the same trailing-trim semantics as generic clamped output.
    - whole-prefix rich patches normalize clamped source boundaries that end in root-level
      whitespace or `wbr` removed by the trailing trim. The live prefix boundary is the rendered
      boundary before that root child, but it is reused only when that rendered prefix is still a
      byte-for-byte source prefix. If the normalized live boundary would hide whitespace trimmed
      inside the previous source leaf, the generic patch rebuilds from the root so full output
      restores the authored markup. When the prefix is safe, the cloned suffix starts from the
      source boundary before the trimmed child, so growing restores the space before later content
      and shrinking can keep the already-rendered wrapper prefix and root ellipsis.
    - hidden-probe images use an inert data URI source while preserving sizing attributes/styles, so
      probe-only candidate churn does not repeatedly fetch remote image URLs
    - inline rich images must have a deterministic layout size before loading; responsive
      resource selection is not preserved inside the hidden probe because measurement depends only
      on the image box
    - rich search now derives warm-start hints from the previous structural decision for nearby
      width changes; the hidden probe's current patch state and the search hint are separate so
      large width jumps can cold-search without resetting or repainting the visible tree
    - after the first full-probe layout inspection for a prepared rich source and probe body,
      RichLineClamp caches
      the resulting searchable logical runs and word-rank points; warm passes can then patch the
      hidden probe directly from its previous structural state to the first candidate instead of
      rebuilding the full rich tree only to rediscover the same searchable layout
    - when the cached search index came from a simple all-text inline layout, the same current-DOM
      reinspection used for height-based line counting can also refresh the cached logical runs if
      CSS has since made an inline wrapper atomic. A wrapper that becomes `inline-block` must be kept
      or dropped as a unit; cached text cuts from the earlier transparent-inline layout must not
      continue slicing inside it.
    - cached rich logical runs also refresh when an atomic wrapper came from `display: var(...)`
      (including declarations nested in active CSS grouping rules such as matching `@media`) and
      the current CSS variable value makes it transparent inline again. Without that reverse
      invalidation, a stale atomic run would keep returning only the ellipsis even though the
      wrapper text can now be sliced and partially shown. Static class or inline-style atomics, and
      variable declarations inside inactive media rules, do not pay this extra refresh path while
      the stylesheet collection is stable.
    - cached rich indexes with element descendants record a lightweight stylesheet signature from
      their layout inspection: the stylesheet count, active grouping rule-list counts, and each
      style rule's selector plus `display` and a combined line-metric key covering `font-size`,
      `line-height`, and `vertical-align`. If an application inserts/removes a stylesheet or mutates
      active CSSOM rules
      before a later reclamp, the hidden probe is restored to the full rich tree and inspected once
      before reusing the index, because a later cascade rule can turn a previously static atomic
      wrapper back into searchable inline text or invalidate cached simple-line metrics. Media query
      match-state changes are covered by the same rule because inactive grouping bodies are omitted
      from the signature and active grouping bodies are included.
    - a single rich clamp pass shares one lazy stylesheet signature between variable-display cache
      invalidation and cached search-index identity checks, so cached metadata refreshes do not
      rescan the same stylesheet collection inside one synchronous reclamp.
      All-text rich search indexes store an empty stylesheet signature and skip stylesheet scans
      entirely because their logical runs cannot be invalidated by CSS selectors.
      The same signature scan records active selectors whose `display` declaration contains
      `var(...)`; style-dependent atomic detection matches against that selector list instead of
      reading `cssRules` a second time.
      If any stylesheet's rules are unreadable, rich atomic descendants are treated as
      style-dependent for this purpose because the runtime cannot prove whether an inaccessible rule
      uses `display: var(...)`.
      Active stylesheet declarations that use `var(...)` in `font-size`, `line-height`, or
      `vertical-align` conservatively disable the trusted width-only simple-line reuse path because
      a CSS variable value can change child line metrics without changing the stylesheet signature.
      The stylesheet walk must still visit every active stylesheet and grouping rule after it finds
      such a line-metric variable, because the same pass also appends the signature and collects
      later `display: var(...)` selectors.
    - trusted width-only RichLineClamp reclamps can reuse a cached simple-line fit by reading only
      the rich body style and comparing its `font-size`, `line-height`, and `vertical-align` key.
      If the key changed, if style-dependent display or line metrics may be present, or if the
      reclamp did not come with a root-width snapshot, RichLineClamp falls back to full rich layout
      inspection before using the cached search index.
      This simple-line shortcut remains limited to the no-affix `content -> body` probe shape:
      broadening it to affix-bearing metadata rows did not reduce rect-list counters, so those rows
      still need a separate affix-aware line-count proof before their exact rect cost can be cut.
      Rich atomic runs also cannot reuse LineClamp's `verifyOverflow` affix line-fit cache directly:
      a tested version changed inline-block keep/drop behavior, so any future proof must preserve
      atomic-run boundaries explicitly.
    - RichLineClamp keeps a narrow exact-width result cache for repeated Vue-driven width updates.
      A cached structural result may be reused only when the reclamp comes with a fresh root-width
      snapshot, the root has a fixed inline width/font style and no class, the affix signature is
      part of the cache key, the cached rich search index has no style-dependent display or line
      metrics, source inline styles do not contain unresolved `%` or `var(...)` references, active
      stylesheets are readable and contain no `var(...)` declarations, and the key includes the
      current stylesheet rule text plus root/ancestor id/class/style context. Font-load
      invalidations clear this cache before the next reclamp. This cache targets repeated exact
      widths only; novel-width Rich searches still measure live candidates. Exact-result cache keys
      are tuple-encoded rather than delimiter-joined so attribute or stylesheet text cannot blur
      field boundaries.
    - when a hinted rich text run reaches its end and the following atomic run has already been
      measured as fitting, the subsequent coarse search starts from that proven atomic run instead
      of restarting from the previous complete run; the search helper still revalidates the hint, so
      this is a cost hint rather than a skipped correctness check
    - clamped-to-clamped whole-prefix patches keep the root-level ellipsis text node stable when
      the retained source prefix does not need trailing-whitespace trimming. Growing inserts the new
      source suffix before that ellipsis, and shrinking removes source suffix siblings before it.
      Full-state patches and whitespace-sensitive boundaries still use the generic remove/append
      path so rich whitespace semantics stay explicit.
    - `boundary="word"` rich searches can extend warm-hint reuse beyond the fixed width window only
      after a previous resize has measured the current structural rank-per-pixel slope and the
      estimated warm-start probe count is better than the cold-search probe count, or is within a
      one-probe patch-locality budget justified by the current line limit. Default grapheme rich
      searches keep the fixed local window because they do not publish a comparable text-rank
      slope.
    - RichLineClamp deliberately keeps the small local width window as a bootstrap and patch-locality
      rule instead of replacing all warm decisions with rank math. A tested all-width dynamic gate
      rejected too many small local resizes and increased ordinary word jitter work, because the
      rank probe model does not fully account for how cheap same-suffix rich DOM patches are.
      Likewise, Rich does not inherit Text's extra `rankMove <= coldProbes` guard: applying that
      guard to the Rich warm-cost check increased long-token font-tick child-list churn, showing
      that the broader Rich warm path is doing useful DOM-local work beyond the scalar probe model.
    - RichLineClamp can also skip the separate preliminary full-rich fit read beyond the fixed
      window for word-boundary grows when the observed rank slope still predicts a clamped target;
      same-width and growing passes verify the full-rich candidate before returning a clamped
      result, while shrinking passes rely on the monotonic proof from the previous clamped state
    - same-width Rich recomputes, such as font-load invalidations, preserve any previously observed
      rank-per-pixel slope; they refresh layout against the current font metrics but do not turn the
      next large resize back into an avoidable cold search
    - same-width/font Rich recomputes still keep the full-candidate verification boundary. Synthetic
      font ticks make that path look expensive, but a real font metric change can make previously
      clamped rich content fit at the same width, so skipping the full probe needs a stricter
      unchanged-font proof than the runtime currently has. Browser regressions cover same-width
      font-metric shrink for both text and rich clamps: clamped `24px` content must restore to full
      at `12px` after a font-load notification. The package matrix has matching Line/Rich
      same-width font-recovery rows so future font-invalidation optimizations are measured against
      that boundary. Likewise, retaining hidden-probe suffix nodes and hiding them is not a retained
      strategy because it would trade child-list churn for visibility/attribute state without yet
      proving lower total mutation work. Even in the hidden probe, that strategy needs a new
      representation contract because the shared Rich patcher assumes clamped suffix nodes are
      physically removed and the ellipsis is the rich body root's last text node.
    - LineClamp uses the same slope-preservation rule for same-width font invalidations through
      `previousRankSlope`; the public matrix keeps a matching Line long-token font-tick row so this
      input shape is guarded rather than only inferred from the implementation
    - text warm gates carry `hasAffixes` as explicit layout metadata. `layoutKey` still identifies
      the measured slot geometry, but the search cost model no longer parses the no-affix
      `"0x0|0x0"` key as a semantic signal.
    - the beyond-window search hint and the full-fit skip deliberately use different guards:
      search-hint reuse requires a meaningful text rank because it chooses where local expansion
      starts, while full-fit skipping does not use that rank as the answer and therefore should not
      inherit the same atomic-whitespace guard
    - displayed line count is already represented in that Rich rank slope: more visible lines tend
      to produce a larger visible rank per pixel, so the same width increase reaches the full
      candidate sooner and the dynamic full-fit skip naturally narrows; direct diagnostics still
      keep the fixed window when no observed slope exists
    - RichLineClamp only applies that beyond-window word hint when the previous clamp point is a
      meaningful source text position: non-empty text prefixes are safe, whitespace-only text
      prefixes are accepted only when they are not adjacent to inline-atomic neighbors, and affix
      signatures must still match. That safe-text signal comes from `clampRich`'s computed-style
      logical runs, not from parsed inline styles alone, so class-styled `inline-block` atomics are
      covered by the same guard as inline-style atomics.
    - word-boundary rich rank hints are published only for cuts that exist in the word-rank point
      set; fallback grapheme cuts deliberately return no rank so they cannot poison later
      rank-per-pixel estimates as rank zero
    - when affix geometry is unchanged and the previous rich boundary was inside a searchable text
      run, RichLineClamp first refines inside that same run before falling back to the normal coarse
      run search; it returns early only when an internal same-run cut proves the next cut fails, or
      when the run end is already final because there is no later run or the next unsliceable atomic
      run fails, so stable metadata-affix resize paths avoid redundant probes without trusting the
      shortcut across slot-size changes
    - direct helper callers that pass the same structural state as both `from` and `hint` get the
      same text-run refinement by default; RichLineClamp still passes an explicit guarded boolean so
      affix geometry changes cannot accidentally inherit that shortcut
    - RichLineClamp uses a slightly wider local warm-search expansion window than the shared text
      helper because logical runs are coarser than text boundaries; the shared helper default stays
      narrower for LineClamp, InlineClamp, and WrapClamp
  - sanitization stays the caller's responsibility
  - the runtime measures rich candidates in a connected hidden probe so the visible rich subtree is
    not mutated during binary search
- `before` and `after` slots render directly into the same inline flow and are observed for size changes via `ResizeObserver`.
- `WrapClamp` treats each item as an atomic box and uses a single visible-DOM clamp engine:
  - collapsed states are measured from the real rendered `before` / items / `after` sequence
  - the engine settles by shrinking to a fitting prefix, then probing upward one item at a time
  - measurements come from the rendered content DOM directly instead of a separate per-item ref cache
  - the baseline grow solver remains linear because each candidate can change arbitrary slot output
    and item widths; narrow hints may jump to a better starting count only when benchmarked counters
    improve and the baseline still performs final live-DOM settlement
  - a May 2026 hidden-probe prototype for low expected work passed correctness tests but worsened
    the table benchmark by materially increasing item slot calls and rect reads, so the hidden
    measurement-island direction is deferred until it can prove candidate changes do not rerender
    arbitrary item slots
  - the accepted May 2026 fast path is deliberately narrower: no `before`, no `after`, no
    `maxHeight`; it records item-shell widths after verified public DOM measurement and uses those
    widths only as a visible-count hint before handing control back to the live-DOM settlement loop
  - removing the no-affix metrics count hint was measured and rejected: the code became simpler, but
    no-affix grow increased rect reads and median time because more work fell back to live
    settlement
  - later May 2026 no-affix work added two accepted solver paths:
    - shrink-only current-prefix settlement for observed width shrink, which measures the already
      rendered public prefix and avoids a speculative grow/revert probe
    - bounded materialized grow search, which uses Vue once to render a hidden item-shell suffix,
      synchronously toggles component-owned item shell display during search, mutates only the
      changed display range between candidates, restores candidate mutation before yielding, commits
      one final count, and verifies with live DOM
  - materialized grow is a no-`after` static-flow path; it supports `maxLines` and no-`after`
    `maxHeight` cases, while dynamic `after` remains excluded
  - its materialization coverage is adaptive rather than one fixed count:
    - estimate the likely visible frontier from the current root inline size, line limit, and
      verified visible item widths
    - empirical calibration across item widths and container widths showed the best fixed-width
      frontier follows `lineLimit * floor(rootWidth / measuredItemWidth) + 1`
    - the `+1` is intentional: it gives DOM search an overflow side when the estimate lands exactly
      on the fitting frontier
    - the current estimator is expressed as a small flow simulation, not only the fixed-width
      formula: known item widths use recorded live metrics, unknown hidden item widths use the
      observed average fallback, and the first predicted overflow item is included for DOM search
    - cap the estimate by a per-line materialization budget so arbitrary item variation and very
      large containers still fall back conservatively
    - verify the final committed result against live DOM
  - fixed materialization budgets were measured and rejected as too workload-specific:
    - 24 was good for the original 40px-item / 520px-container benchmark and large-N case
    - 32 was better for narrower items and wider containers
    - the adaptive budget preserved the large-N result while matching the wider-frontier scenarios
      more closely
    - the later regression-calibrated frontier removed the remaining fixed-width overestimation and
      fixed the narrow-item / wide-container under-coverage that still fell back to baseline
  - no-affix and static-affix cases should be treated as one future `static-flow` solver family:
    - absent `before` / `after` are zero-size static affixes
    - static `before` / `after` can share the same item-shell materialization, DOM candidate
      mutation, final commit, and live verification path
    - user-facing performance hints may later enable static-after participation, but the internal
      route should be reserved before the public API exists
  - accepted static-flow predictions share one internal pure placement model:
    - the model places atomic before/items/after boxes into lines by inline size
    - unknown item widths return an `unknown` result instead of inventing proof
    - callers decide whether an overflow result means a fitting count, a materialization frontier,
      or a dynamic-after starting hint
    - materialized DOM search and dynamic-after estimation share the same largest-fitting-candidate
      binary-search helper
  - uniform-width grow hints are allowed only for no-`after`, no-`maxHeight`, `maxLines` solves:
    - the fallback width is derived from already measured live item boxes only when at least two
      positive finite widths exist and their spread stays within layout tolerance
    - mixed-width rows therefore keep the older measured-width-only behavior instead of inventing a
      hidden-item width
    - no-affix grow can use the uniform fallback before materialized grow, while before-only grow
      first measures the current `before` box and includes its width in the same static-flow
      estimate
    - both paths are hints, not proofs: final acceptance still goes through the existing
      materialized/live DOM settlement and verification
  - stable `before` grow is now included in the materialized grow path when `after` is absent:
    - stable means observed-stable inside the current solve, not inferred-static as a public
      contract; without a user hint the component cannot know a slot is generally static
    - the `before` shell is measured before DOM search and compared again after the final commit
    - if the `before` geometry changes, the fast path is not accepted and the baseline solver
      finishes settlement
    - the frontier estimate accounts for `before` consuming first-line inline space
  - a `staticAfter` public hint prototype was tested and rejected:
    - even with correctness preserved by final baseline settlement, the hinted path increased item
      slot calls, after slot calls, rect reads, and elapsed time
    - no public hint is currently exposed; future hints need a different implementation and a
      counter win before becoming part of the API
  - no-`after` `maxHeight` grow now uses the same materialized item-shell DOM search:
    - the fit predicate remains monotonic because there is no dynamic `after`
    - candidate checks measure against the real root clip box
    - maxHeight-only materialization budget estimates an effective line count from root visible
      height and the first visible atomic box height
    - the line-count estimate is only a search budget; final acceptance still comes from live DOM
      verification
  - shrink-only current-prefix settlement is also allowed for `before`-only / no-`after`
    scenarios:
    - it measures the currently rendered public sequence, commits the smaller fitting prefix once,
      and verifies live DOM
    - final acceptance requires the committed `before` geometry to match the geometry used for the
      shrink decision
    - dynamic `before` therefore falls back to baseline without leaving materialized suffix state
  - materialized `after` grow was tested and rejected for now:
    - final geometry comparison alone can still underfill count-sensitive `after`, because a wider
      old `after` may prevent discovering a valid candidate with a narrower final `after`
    - forcing `after` cases through materialized grow worsened table and single-line benchmark
      counters, so `after` stays on the baseline path until a stricter static-affix signal exists
    - fixed-size static-after benchmark rows now exist, but without a public/static contract they
      intentionally use the same guarded dynamic-after path as arbitrary `after`
  - the accepted dynamic-after optimization is a jump-grow hint, not a proof:
    - live `measureSequence` reads now record item widths without extra item rect reads, so later
      solves can reuse already-paid visible DOM metrics
    - when `after` exists and `maxHeight` is absent, a large width grow may estimate a better
      starting count by simulating `before + items + current after` with measured/average item
      widths
    - the hint is gated by observed geometry: the width delta must be at least one average measured
      item width, which makes it a jump-grow path and keeps gradual width sweeps on baseline
    - it does not create a hidden probe, does not materialize arbitrary after DOM, and does not
      accept the estimate as final; the baseline live-DOM solver still verifies and settles
    - the main benchmark target is stable/static before plus count-sensitive dynamic after, which
      dropped from about `48100` item slot calls, `52100` rect reads, and `500ms` to about `17500`,
      `14700`, and `186ms`
    - arbitrary dynamic before remains lower priority because before geometry appears before all
      items and can invalidate every downstream line break
    - widening the jump-grow hint to gradual grow was measured and rejected: slot calls stayed flat
      while rect reads rose in both table and single-line sweeps
    - a dynamic-before confidence prototype that disabled static-flow paths after one before
      geometry mismatch was also rejected; it increased before slot calls, item slot calls, rect
      reads, and elapsed time versus the current failed-fast-path-plus-baseline behavior
    - dedicated dynamic-before grow and shrink benchmark rows now guard that behavior
  - `after` shrink was also tested with a conservative candidate-first path and rejected:
    - it did not reduce slot calls
    - it increased rect reads in both the dedicated after-shrink benchmark and the existing
      dynamic-after table scenario
    - after-specific shrink now stays on the baseline path, with a browser guard for hidden-count
      digit-boundary changes
  - no-`after` shrink is allowed to use `maxHeight` clipping now:
    - the path still uses only the currently rendered public prefix
    - it measures with the real root clip box, commits one smaller prefix, and verifies live DOM
    - before+maxHeight and mixed maxLines+maxHeight benchmark rows confirm this same static-flow
      path covers those cases without a separate solver branch
  - a last-line slack / single-next-item probe was measured and rejected:
    - the strict version still used live DOM by materializing only `current + 1` when the width
      estimator predicted no count increase
    - it was correct, but incomplete hidden-item width data made it under-materialize grow cases,
      then fall back to linear baseline
    - no-affix grow slot calls and rect reads rose sharply, so this path should not be revived
      without a stronger verified slack model
  - scheduler work remains deliberately scoped:
    - a table width-churn benchmark now tracks same-batch parent width changes
    - a microtask scheduler prototype passed correctness but did not reduce slot calls or rect
      reads, so it was rejected
    - a broader global scheduler should not be introduced until paired with a solver change that
      demonstrably reduces candidate work without delaying ResizeObserver settlement past a paint
  - CSS gap, content alignment, and reactive slot-width changes are covered by browser guards:
    - CSS gap is left to final live DOM verification rather than approximated in the estimator
    - content `align-items:center` and `align-items:baseline` with mixed-height items are covered
      by block-overlap row detection instead of top-equality grouping
    - reactive item width changes with the same `items` array settle through ResizeObserver,
      same-flush updates, and live DOM verification; no item-array identity cache is trusted
  - root/content/before/after layout invalidation uses the same subpixel border-box signature
    strategy as Line/Rich/Inline:
    - synchronous layout signatures use `getBoundingClientRect()` quantized to 1/1000 CSS px
    - ResizeObserver watches the border box and compares entry `borderBoxSize` against the last
      settled signature without fresh offset reads
    - transformed ancestors and vertical/sideways writing modes use a visual-signature fallback so
      layout-pixel entry sizes do not cause repeated false positive reclamps
    - same-flush Vue updates with unchanged geometry still invalidate measured item-width caches,
      while pure external fractional resizes are left to the observer path
  - vertical/sideways writing mode is deliberately outside WrapClamp's supported contract:
    - `maxLines` and `maxHeight` are defined for horizontal wrapping rows and the root's vertical
      clip box
    - the solver no longer inspects CSS `writing-mode` or maps DOM rects to logical axes
    - future vertical behavior would need explicit product/API design rather than implicit solver
      branches inside the current API
  - heavy item slot benchmark coverage confirms elapsed time follows item slot work:
    - the heavy no-affix grow row keeps the same item slot and rect-read counts as the normal
      no-affix grow row but takes roughly `75ms` longer
    - this reinforces the rule that future solver branches must lower arbitrary item slot calls or
      rect reads, not merely move the work into another rendering path
  - `hiddenItems` remains the public slot prop and is sliced directly from the current item array
  - keep item order logical in the DOM so RTL works through inherited browser direction

### SSR direction

- The preferred SSR direction remains a DOM-preserving visual skeleton rather than approximate
  native CSS fallback.
- The package currently has no stylesheet delivery contract or CSS side-effect entry. Because the
  skeleton requires media-aware CSS such as `@media (scripting: enabled)` to keep full content
  visible for no-JS users, it is deferred until the CSS delivery contract is designed.
- Exact native SSR subsets may still render full content with native styles when the component can
  prove semantic equivalence, but unsupported browsers must hydrate into the measured DOM path.

### Reactivity and trade-offs

- `LineClamp` recalculates on:
  - root width changes
  - slot size changes
  - text changes
  - relevant prop changes
  - font readiness events when available
- `RichLineClamp` follows the same invalidation model, but tracks `html` source changes instead of
  text-location changes. Inline rich images must provide stable layout dimensions up front; image
  loading does not schedule an extra clamp pass.
- `LineClamp` and `RichLineClamp` both re-run their clamp pass in `onUpdated` when their own
  rendered layout signature
  changes, so reactive width/slot changes in the same Vue flush do not wait on a later
  `ResizeObserver` delivery.
- Browser coverage now distinguishes the two important width-shrink timing cases for rich mode:
  - same-flush reactive width shrink through Vue update timing
  - external async container width shrink through `ResizeObserver`
- `WrapClamp` follows the same philosophy:
  - root/content/slot size changes
  - item source changes
  - relevant prop changes
  - font readiness events when available
- `LineClamp` and `RichLineClamp` share recompute coalescing through `multiline.ts`; `WrapClamp`
  still uses the same queued-task helper directly.
- `WrapClamp` still deduplicates observer-driven work against the last settled observed-geometry
  signature.
- Production clamp code no longer uses `offsetWidth` / `offsetHeight` for layout signatures; those
  integer box reads remain only as benchmark counters and benchmark scenario sampling.
- `LineClamp`, `RichLineClamp`, and `WrapClamp` now treat `ResizeObserver` as part of the required browser baseline instead of carrying runtime existence fallbacks.
- Removing that settled-signature guard was measured and rejected:
  - single-line benchmark:
    - `176` -> `212` `getBoundingClientRect()` calls
    - `68` -> `76` item slot calls
    - `129.5ms` -> `127.7ms` median total, effectively flat
  - table benchmark:
    - `16700` -> `28300` `getBoundingClientRect()` calls
    - `15300` -> `23300` item slot calls
    - `310.3ms` -> `392.9ms` median total
- The text and wrap components intentionally stay close to the naive Vue 2 model:
  - no hidden-first-paint gate
  - no synthetic line-height-derived clipping guardrail
- The remaining trade-off for the multiline components is narrower now:
  - external async resize/font transitions outside the component's own Vue update cycle may still
    briefly show stale content before the observer-driven recompute settles
- In exchange, correctness does not depend on line-height modeling and the runtime is much easier to follow.
- The dedicated browser benchmark now measures the shipped runtime directly:
  - single-line width sweep median:
    - `129.2ms` total
    - `8.08ms` per measured width step
    - `176` `getBoundingClientRect()` calls
  - table-demo width sweep median:
    - `315.0ms` total
    - `39.38ms` per measured width step
    - `16700` `getBoundingClientRect()` calls

## Constraints and Trade-offs

- `LineClamp` source content comes from `text`, not from the default slot.
- `RichLineClamp` accepts trusted or already-sanitized inline HTML through `html`.
- The implementation favors browser truth over a mathematically modeled layout engine.
- File layout now follows the domain boundaries directly:
  - component-family public contracts are colocated with their component source under `line/`,
    `rich-line/`, `inline/`, and `wrap/`
  - shared multiline shell behavior lives in `multiline.ts`
  - shared Line/Rich render-only affix-slot plumbing lives in `multiline-render.ts`
  - static internal style contracts live in TS `styles.ts` modules, not CSS files, so required
    measurement and accessibility styles are present without side-effect imports
  - dynamic styles that depend on props, model state, or native mode stay in the owning SFC
  - text behavior lives in `text.ts`
  - rich behavior lives in `rich.ts`
  - WrapClamp's private helpers and component-family internal contracts also live under `wrap/`
  - shared low-level layout primitives remain in `layout.ts`
- Internal clamp helpers return direct rendered text where possible, while rich clamp returns a
  structural boundary decision so width-only reclamps do not serialize or reparse HTML.
- In the `LineClamp` native single-line fast path, the collapsed DOM text remains the full source text and the visual ellipsis comes from CSS overflow rather than a rewritten text node.
- Custom ellipsis strings still fall back to the JS trimming path.
- The JS trimming path still rewrites the visible text node, but accessibility now comes from the hidden full-text sibling rather than a generic-element label.
- Rich HTML does not support source slots, start truncation, middle truncation, or arbitrary
  layout-altering descendants.
- Rich support now follows a best-effort inline-flow model:
  - the runtime no longer rejects broad element classes up front during preparation
  - leaf elements without light DOM content are treated as atomic boxes
  - only transparent inline wrappers (`display: inline` / `display: contents`) are searched
    recursively at clamp time
  - inline formatting contexts such as `inline-block` are treated atomically during search
  - fallback is reserved for rendered layout that exits inline flow or otherwise breaks the clamp
    model
- A small amount of duplicated logic inside the component is still preferred over a large internal
  base runtime, but the repeated multiline shell is now shared because that abstraction
  stayed narrow and direct.
- `WrapClamp` stays data-driven with `items`; arbitrary child-vnode introspection is intentionally out of scope for v1.
- `WrapClamp` follows live DOM measurement for every clamp mode.
- `maxLines="1"` is still the lightest case, but there is no separate predictive one-line engine.
- Browser tests are still the main confidence layer because the component’s behavior depends on real DOM layout.
- The repo now also has a dedicated browser benchmark:
  - config: `vite.browser.benchmark.config.ts`
  - scripts:
    - `vp run benchmark:wrap`
    - `vp run benchmark:rich`
    - `vp run benchmark:source`
  - scope:
    - current `WrapClamp` workloads
    - current rich clamp workloads
  - method: repeated browser runs with stable-state timing
- Release-facing cross-version benchmarks live in the private `tools/benchmark` workspace package:
  - the package owns its Vue / Vite+ browser benchmark tooling and intentionally does not declare a
    `vue-clamp` dependency
  - `vp run benchmark:package -- <target>` installs or resolves the target package, aliases the
    exact `vue-clamp` import to that target entry, and runs browser benchmarks from
    `tools/benchmark/src`
  - `vp run benchmark:package -- --targets <target-a>,<target-b>[,...]` resolves multiple targets
    up front and runs them in one browser benchmark process; for each public scenario, measured
    runs are interleaved by target so local optimization comparisons are less exposed to
    cross-process browser drift. Multi-target sampling stops only between complete target rounds,
    so every target has the same measured sample count for that scenario. Single-target runs keep
    the original schema v3 payload.
  - duplicate target specifiers in a multi-target run are resolved once and then repeated in the
    browser target list. This keeps same-version noise checks such as `--targets current,current`
    from rebuilding or reinstalling the same package twice while preserving two report columns.
  - external package targets are installed into a system temporary directory instead of a path under
    the repo, because Vite+ treats subdirectories inside this repo as part of the workspace
  - package benchmark files call only public component APIs and must not import `packages/vue-clamp/src`
    or other package internals
  - native browser APIs are wrapped only as spies, then delegated to the original implementation, so
    layout remains real browser layout while counters expose broad regression signals
  - Line/Rich word-boundary coverage includes repeated width jumps, continuous/step sweeps,
    ordinary English novel-width jitter, CJK novel-width jitter, long ASCII-token jumps, and rich
    class-styled atomic inline tokens. The jitter rows are coverage guards for input-space shape;
    their smoke timing is intentionally treated as secondary to structural counters.
  - Line/Rich affix-heavy hotspot coverage includes novel-width jitter rows for the Line CTA affix
    and Rich metadata affix shapes. These rows keep the same slot-heavy public scenarios as the
    repeated-width hotspots, but force fresh pixel widths and large jumps so affix-path evidence is
    not limited to revisiting a small width set.
  - Rich height coverage separates `maxHeight`-only rows from explicit `maxLines + maxHeight`
    mixed rows. Height-only rows exercise the visible-bounds bounding-box predicate, while mixed
    rows preserve exact client-rect line counting under the same width churn and affix shapes.
  - benchmark layout-read counters distinguish bounding rects, client rect calls, client rect
    entries, client box getters, offset box getters, and computed-style reads; rect entries are
    tracked separately because one `getClientRects()` call can materialize many inline fragments in
    maxHeight, affix, and rich markup scenarios, while `offsetWidth` / `offsetHeight` and
    `getComputedStyle` are tracked explicitly because signature-style invalidation and Rich layout
    inspection can otherwise hide synchronous layout/style work
  - package timing uses schema v3 and keeps multiple signals:
    `updateMs` measures the width change through Vue flush, `activeMs` measures through the last
    root-local DOM mutation / ResizeObserver / Vue-flush activity, `totalMs` / `meanStepMs`
    preserve the previous width-change-through-stable timing, and `quietMs` isolates the
    conservative quiet-frame wait
  - package benchmark sampling is adaptive rather than a fixed three-run smoke and does not treat
    outer run count as the quality target. `VUE_CLAMP_BENCH_MODE=smoke` keeps quick local checks at
    1 warmup / 3 measured runs. The default report mode uses 1 warmup, at least 5 measured samples,
    at least 2 seconds of measured wall time per scenario, a 30-sample cap, and a 15s
    per-scenario wall budget. Strict mode uses 2 warmups, at least 5 measured samples, at least 5s
    measured wall time, a 50-sample cap, and a 30s per-scenario wall budget. This keeps the runtime
    predictable while still giving each scenario enough repeated samples to expose standard
    deviation. Override knobs are `VUE_CLAMP_BENCH_WARMUP_RUNS`, `VUE_CLAMP_BENCH_MIN_RUNS`,
    `VUE_CLAMP_BENCH_MAX_RUNS`, `VUE_CLAMP_BENCH_MIN_SCENARIO_MS`, and
    `VUE_CLAMP_BENCH_MAX_SCENARIO_MS`. In multi-target mode the measured round stops after all
    targets satisfy the minimum wall time, any target reaches the max wall budget, or every target
    reaches the max run cap.
  - each package scenario summary includes sample count, mean, standard deviation, standard error,
    coefficient of variation, 95% margin of error, 95% relative margin of error, median absolute
    deviation, accumulated
    sampled active time, and sample wall time for numeric metrics. Median active time remains the
    primary comparison value because browser timings are noisy, but the report surfaces precision so
    a single red cell is not treated as a confirmed regression.
  - package benchmark report rendering marks active-time deltas as low confidence when either side
    has high active-time CV, when compared active-time mean margin-of-error intervals overlap, or
    when median and mean active-time deltas point in opposite directions.
    Timing deltas in that region should not be used as proof without supporting structural counters.
  - package benchmark reports display mutation-record totals and adjacent deltas next to layout,
    client-rect-entry, offset, style-read, and slot counters. This keeps DOM patch/rebuild work
    visible in the Markdown/SVG summaries instead of requiring readers to inspect raw JSON when
    validating Rich patch optimizations.
  - mutation records are broken down into child-list, character-data, and attribute records, plus
    added-node and removed-node totals. This distinguishes text-node rewrites, structural rich DOM
    patching, and Vue attribute/style churn instead of treating all MutationObserver records as one
    opaque counter.
  - package benchmark reports include a separate "Top structural movers" section for adjacent
    versions. It ranks scenarios by the largest layout, client-rect-entry, mutation, offset, style,
    slot, clone, replace, scroll, or ResizeObserver counter delta so structural work changes remain
    visible even when active-time movers are noisy or low confidence.
  - package benchmark reports also include "Top structural hotspots by version". This is an
    absolute ranking, not a version delta: it shows the heaviest current scenarios/counters directly
    so the next optimization pass can start from browser-work evidence instead of hand-parsing raw
    benchmark JSON. The same structural ranking is also rendered per component family so large
    WrapClamp counters do not hide LineClamp or RichLineClamp browser-work hotspots during a
    focused optimization pass.
  - package benchmark reports also include "Top low-noise active hotspots by version". It ranks
    rows by median active time only when active RME is at most 5%, and renders structural columns as
    `N/A` when counter tracking is disabled. This gives a quick timing-oriented shortlist without
    treating high-variance rows as optimization targets. The same low-noise filter is also rendered
    per component family so LineClamp and RichLineClamp candidates remain visible even when global
    active time is dominated by other components.
  - package benchmark reports include a "Width profile matrix" when logs contain scenario width
    metadata. This matrix records stable step count, total width assignment count, unique width
    count, repeated assignments/transitions, large-delta threshold, transitions wider than that
    threshold, and max adjacent width delta. It makes repeated-width and novel-width input shapes
    visible in the report itself, so a warm-start optimization cannot be generalized without
    showing whether the row mostly revisits old widths or explores fresh widths. Historical logs
    without the metadata still render, with `widthProfile: null` in JSON and no width-profile
    Markdown table.
  - package benchmark runs define `process.env.NODE_ENV` as `"production"` so the measured Vue
    runtime path matches production package use instead of Vitest's default test/dev runtime branch.
  - package benchmark counter tracking is enabled by default. `VUE_CLAMP_BENCH_COUNTERS=0` leaves
    the ResizeObserver-based stability wait in place but disables the monkey-patched layout, style,
    clone, replacement, and mutation counters. This mode is only for active-time probe-overhead
    checks; reports include `counterTracking` and render structural summaries or deltas as `N/A`
    when counters are off, so zero counters are not mistaken for reduced browser work. Recent
    focused counters-on/off runs put low-noise probe overhead in the low single digits, so timing
    deltas in that band need structural-counter support or a counters-off confirmation.
  - each package scenario logs a concise `BENCH_SCENARIO` line when it finishes, including version,
    target specifier, component, scenario, sample count, measured wall time, accumulated active time,
    median/mean active time, active standard deviation, active CV, active RME, core structural
    counters, compact `extra` counters when present, and the scenario width profile. This makes long
    full-matrix and same-version A/B runs observable without waiting for the final JSON payload, and
    still leaves structural/input-shape clues if the final payload is truncated or the run stops
    early.
  - PerformanceObserver / browser scheduling diagnostics are captured as secondary evidence:
    long task count and duration, long animation frame count and duration when supported,
    requestAnimationFrame interval summaries, dropped frame estimates, and requestIdleCallback
    budget/opportunity counts
  - the cross-version runner uses the full public component matrix instead of a few smoke scenarios:
    LineClamp, InlineClamp, and RichLineClamp rows are chosen from user-facing shapes and stress
    cases first, not from the current optimizer branch map. The matrix covers single-line titles,
    multi-line summaries, CTA / metadata affixes, middle/start/end truncation, file-path split
    truncation, word-boundary copy, height-constrained cards, height-constrained word-boundary
    cards, height-constrained rich cards with before/after affixes, custom ellipsis markers, rich
    inline markup, fit/no-clamp cases, dense rich rows, word-boundary single-token fallback to
    grapheme cuts, word-boundary middle truncation on long-token text, word-boundary long-token text
    with fixed before/after affixes, Line/Rich word-boundary font-load invalidation before large
    width jumps, matching Line/Rich word-boundary font-size metric changes before large width
    jumps, rich word-boundary affix transitions from clamped output back to full-fit output, rich
    class-styled inline atomics, rich wrappers that dynamically switch between inline flow and
    atomic inline boxes, ordinary, CJK, and long-token word-boundary copy under novel large-jitter
    widths, and
    continuous/jitter/jump width changes.
    Some of those public scenarios are naturally eligible for native CSS paths in newer versions,
    but native eligibility is treated as an explanatory diagnostic outcome, not the sole reason a
    scenario exists.
  - InlineClamp 1.0 used a native text-overflow implementation and is not comparable to the
    measured InlineClamp implementation introduced afterward. Package matrix InlineClamp rows
    therefore start at the first version that supports the measured public behavior for that row,
    with older versions rendered as `N/A`.
  - WrapClamp covers the existing table/churn/no-affix/large-N/heavy-slot/before/after/maxHeight
    matrix because those rows already represent realistic list/tag/table workloads and known
    extremes.
  - LineClamp, InlineClamp, and RichLineClamp package scenarios render realistic multi-instance
    batches by default rather than a single isolated component. The regular batch size is 16
    component instances sharing the same width churn, and the dense rich scenario renders 40
    instances. This makes timing large enough to be meaningful and better represents application
    screens where many clamped rows/cards update together.
  - package scenario names include `batch` for those multi-instance LineClamp / InlineClamp /
    RichLineClamp cases so new cross-version results are not mixed with historical single-instance
    smoke data. If single-instance fixtures are useful later, keep them as local diagnostics rather
    than release-facing comparison rows.
  - settled timing waits on root-local DOM mutation activity plus ResizeObserver callback activity,
    not serialized DOM snapshots or extra layout reads; settled time is preserved for end-to-end
    comparison but active time and counters are the primary optimization/regression signals
  - `vp run benchmark#report -- <log-dir> [output-dir] --versions <comma-list>` renders matrix
    Markdown, SVG, and raw `.local.json` reports from package benchmark logs; the explicit version
    list should cover the applicable Vue 3 release line, while unsupported features inside that line
    are shown as `N/A`
  - raw matrix JSON is generated with a `.local.json` suffix and ignored by Git; commit the
    human-readable Markdown/SVG reports, not the large per-sample data artifact
  - report rendering extracts the final `PACKAGE_MATRIX_BENCHMARK` payload by parsing the balanced
    JSON object after the marker instead of relying on a single-line regex; Vitest can interleave
    its own summary into very long browser console payloads, so the renderer tolerates those summary
    lines when reconstructing package benchmark logs
  - package benchmark runs also emit `PACKAGE_MATRIX_SUMMARY`, a compact per-scenario median-counter
    payload without per-run samples; use this for local optimization loops that need full-matrix
    structural totals but do not need the large raw report
  - compact summary schema v2 keeps the fixed structural counter fields and adds a per-scenario
    `extra` object for median structural counters outside the fixed set, such as slot calls,
    clone/replacement calls, ResizeObserver callbacks, and future diagnostic `*Calls` counters.
    The target-level payload also includes `extraTotals`, so local parsers can rank those structural
    costs without scanning every scenario manually.
  - report rendering also accepts schema v4 multi-target payloads emitted by same-process
    `--targets` runs; those payloads contain normal schema v3 report objects under `reports`, and
    the renderer flattens them before building the matrix. When multiple targets report the same
    package version, matrix columns use compact target labels instead of version-only keys so
    same-version A/B reports do not collapse distinct targets into one cell.
  - report rendering warns and ignores unrelated `.log` files in the chosen log directory that do
    not contain a package benchmark marker, while still failing on malformed benchmark payloads.
    This lets local runs write renderer stdout/stderr next to benchmark logs without silently
    mistaking a missing benchmark payload for a valid empty result.
  - `VUE_CLAMP_BENCH_SCENARIOS` can filter package runs by exact scenario name, scenario group
    (`line`, `inline`, `rich`, or `wrap`), or component name; this is local optimization tooling for
    repeated hotspot loops and keeps full release-facing reports unfiltered by default
  - generated reports include both full-version absolute active-time matrices and adjacent-release
    delta summaries, so the output is not anchored only on the latest release pair
  - adjacent-release summary rows expose how many comparable scenarios have low-confidence
    active-time deltas, and prefix the aggregate active delta with `~` whenever at least one
    constituent timing row is low confidence. Aggregate timing therefore stays visible without
    hiding the weaker evidence behind summed medians.
  - reports must distinguish speed from correctness coverage: when a release fixed missing reclamp
    triggers or incorrect output, older-version lower cost is not treated as a pure performance win;
    the Markdown report carries adjacent-release caveats for those behavior changes
  - adjacent-release SVG cells mark low-confidence timing deltas with `~` when either side has
    active-time CV above 10%, the active-time mean MOE intervals overlap, or median and mean
    active-time deltas point in opposite directions;
    those cells keep the normal direction color and add a top-right triangle marker because they are
    not strong evidence of an algorithmic regression or optimization by themselves
  - counter-tracked benchmark timing is interpreted together with its counters: layout, style, and
    mutation counters are the primary proof that workload changed, while small active-time deltas
    need non-overlapping uncertainty or a counters-off timing check before they are described as an
    elapsed-time optimization
  - after the Line/Inline/Rich warm-search and exact-width cache passes, local performance work is
    considered converged unless a change starts from a new structural hypothesis and proves reduced
    browser work in a same-process A/B or a broader input-space matrix. Do not keep tuning
    RichLineClamp cache guards, warm-rank thresholds, or simple-line gates without new evidence; the
    remaining credible Rich performance work is design-level hidden-probe DOM representation or a new
    affix/atomic line-count proof.
  - the latest current-only full smoke over the expanded public matrix keeps that stop condition:
    all `102` rows report zero offset-box reads, repeated-width Rich and Inline rows show their
    exact-result caches firing, and the remaining high rows are novel-width candidate search,
    affix/slot work, Rich exact line counting, or Rich long-token mutation churn. Treat further
    performance work as a design spike with an explicit counter target, not as another local
    threshold/cache-guard tweak.
  - a focused Rich hidden-mutation breakdown now shows that the next credible hidden-probe DOM
    representation spike should target hidden child-list churn first: the sampled Rich hotspot rows
    had `87.9%` of child-list mutation records and `88.8%` of added/removed nodes inside
    `aria-hidden` probe subtrees.
  - the first retained hidden-probe step keeps cached Rich results as logical warm hints without
    immediately patching the hidden probe body on cache hits; this reduces repeated-width long-token
    hidden child-list records, but does not address font/style invalidation or novel-width probe
    churn
  - a follow-up Rich hidden-probe representation spike that kept wrapper elements mounted and
    emptied out-of-range text nodes was rejected: it nearly eliminated hidden child-list records, but
    turned the search into many `characterData` writes, increased total mutation records, lost the
    counters-off timing comparison, and added about `0.87 kB` gzip. Future representation work must
    reduce total DOM write work or counters-off active time, not only hidden child-list churn.
  - a temporary Rich patch-path probe showed that remaining long-token hidden child-list churn comes
    from `patchForwardWholePrefix` / `patchBackwardWholePrefix` moves across transparent inline
    wrapper boundaries, not from repeated same-text cuts. Do not spend more time on `patchSameTextCut`
    variants for this hotspot; the remaining credible levers are fewer whole-prefix probes or a
    hidden-probe representation that lowers total mutation work, not just child-list records.
  - a follow-up Rich warm-hint disable spike rejected the simplest "fewer whole-prefix probes"
    lever: forcing RichLineClamp to ignore its search hint increased long-token mutation records from
    `3808 / 8480 / 16114` to `8016 / 34064 / 30898` in the focused counter smoke. Warm hints are
    currently preventing work in these rows; any future search-shape change needs a narrower proof
    than disabling the existing hint path.
  - a narrow Rich simple-line refresh special case is retained for inherited child line metrics:
    when the cached rich search index already proved transparent inline wrappers and the current
    stylesheet scan has no line-metric declarations, a root font/line-height change can refresh the
    simple-line fit from the root computed style alone instead of re-reading each child style. This
    is not a broader affix/atomic line-count shortcut; inline child line-metric styles, stylesheet
    line-metric declarations, style-dependent display, or non-baseline root vertical alignment still
    fall back to full layout inspection.
  - convergence-phase code cleanup is still valuable only when it reduces drift risk around retained
    behavior, such as naming guard differences, making mutable-state snapshots explicit, or
    centralizing shared input construction. These cleanups carry no performance claim and should be
    validated with focused tests that cover the retained policy they touch.
  - convergence-phase cleanup should favor deletion, directness, and precise local names over new
    abstraction. Do not keep compatibility paths for obsolete internal contracts, and introduce a
    helper only when it removes real duplication or makes a retained invariant harder to break.
  - RichLineClamp state naming now deliberately separates the latest measured result
    (`measuredState`, `measuredWidth`, and related hints) from the hidden probe DOM patch origin
    (`probeDomState`). Cached-result hits may update the measured state without patching the hidden
    probe body, so future cleanup should preserve this distinction.
  - source-level direct-helper benchmarks remain under `packages/vue-clamp/tests` and are local
    diagnostics only, not cross-version comparison fixtures

## Repo Standards

- Use Vite+ commands only.
- Workspace catalog dependencies use public npm package names directly; `vite` resolves to public
  npm `vite@^8.0.11` rather than a package-manager alias.
- The website hero should lead with real use cases instead of component taxonomy. The animated line
  now rotates through a randomized but category-balanced set of concrete nouns from the multiline,
  rich, inline, and wrapped-item surfaces, while the API names remain `LineClamp`,
  `RichLineClamp`, `InlineClamp`, and `WrapClamp`.
- The website hero tagline measures exact hidden inline text states for its animated width:
  expanded widths are measured as `start + word + end` with an 80px reserve so the ease-out does
  not visually catch on the final glyph, and the collapsed width is measured exactly as
  `start + ellipsis + end`. Do not estimate the collapsed width from individual pieces; the
  animated collapsed frame should match the rendered text width closely.
- The website `RichLineClamp` demo is intentionally more realistic than the API snippet:
  - editable trusted inline HTML
  - preset content covering release notes, styled article excerpts with nested emphasis inside
    links, `code`, `mark`, `br`, `wbr`, inline `svg`, and an inline custom wrapper example
  - the interactive demo surface now mirrors the three generic `LineClamp` examples:
    `max-lines` + `after`, `max-height` + `before` + external expanded control, and
    `clampchange`
  - the location/ratio example intentionally remains text-only because `RichLineClamp` is
    end-truncation-only
  - the rich preview starts at `420px` wide by default so the article-style clamp is easier to read
    without immediately expanding to the wider text demo baseline
  - the live preview also exposes a `CSS Hyphens` toggle so article-like copy can be compared with
    and without browser hyphenation
  - the preview keeps the example focused on article copy itself and uses the expand toggle as the
    only chrome around the clamp
- The website component demos use one sticky shared-controls bar below the component tabs:
  - the component tabs have a fixed block size and shared controls use that same value as their
    sticky `top`, so the two sticky surfaces stack without a gap
  - large source editors stay just above the sticky controls for `LineClamp` and `RichLineClamp`
  - shared controls own cross-example settings such as boundary, width, hyphens, direction, and
    inline location/ratio
  - `WrapClamp` shares width and direction across its tabs and invitees examples
  - example-local controls are reserved for options that are unique to one example, such as
    `max-lines`, `max-height`, expansion, ellipsis, and event state
  - single-line controls share one compact control height so labels, pills, ranges, inputs, and
    checkboxes align predictably
  - on narrow screens, each shared-controls bar collapses behind a compact toggle and expands in
    place to avoid cramped wrapping
  - the demo section has a manual stress playground modal for high-count workloads across all four
    public components:
    it opens with the currently active component selected, renders 10-200 real instances on a
    linear count slider, switches between `LineClamp`, `RichLineClamp`, `InlineClamp`, and
    `WrapClamp`, scales text length or wrapped item count, chooses one active `maxLines` or
    `maxHeight` limit mode at a time, shares one width slider across every item, and keeps the FPS
    meter scoped to that modal instead of the normal demo surface. When the `LineClamp` workload
    matches the native CSS fast-path conditions, the playground shows a compact native marker. It
    locks page scroll, keeps keyboard focus inside the modal, and stays in a centered section after
    the normal examples. It loads only when opened because it is diagnostic tooling rather than the
    primary demo path.
- The website component tabs now have stable direct-link hashes:
  - `#line-clamp`
  - `#rich-line-clamp`
  - `#inline-clamp`
  - `#wrap-clamp`
  - the active surface is initialized from recognized hashes and follows later `hashchange`
    navigation without interfering with unrelated section hashes such as `#installation` or
    `#components`
- The website "Choose a surface" section is now a simplified surface guide:
  - no dedicated heading; the section is introduced by one short sentence describing the four
    exported components directly
  - four linked tiles in a simple responsive grid
  - each tile keeps only the component name plus one concise chooser sentence
  - the grid stays sharp and structural rather than leaning on soft card styling
  - the only decoration is one tiny solid triangle in the top-right corner of each tile, using the
    normal border color at rest
  - hover / focus highlight uses a dedicated overlay border so the whole cell outline lights up
  - guide entries still link directly to the matching component-tab hashes
- The website scroll surfaces now use `overlayscrollbars` instead of native scrollbars:
  - the page body is initialized from the root app and bridged with `data-overlayscrollbars-initialize`
    on `html` and `body`
  - shared horizontal containers use one small directive-backed helper
  - the OverlayScrollbars library and stylesheet load asynchronously on first decorated scroll
    surface instead of joining the primary website bundle
  - the current targets are the page body, demo preview frames, code blocks, and the stress
    playground modal/workload scroll areas
  - `ComponentTabs` stays on its native horizontal scroller so its bespoke mobile overflow behavior
    remains independent from the shared scrollbar layer
- The website keeps non-primary presentation tooling out of the initial `App.vue` bundle:
  - `CodeBlock.vue` is an async component
  - Shiki highlighting is build-only:
    - `packages/website/vite.highlight.ts` turns `?highlight=vue` snippet imports and the virtual
      installation-command module into static highlighted HTML during Vite builds/dev transforms
    - `packages/website/src/highlight.ts` stays a build helper and is no longer imported by the
      browser runtime
    - raw code strings still ship for copy behavior and plain fallback rendering, but the Shiki
      grammar engine and regex compiler do not ship to the website browser bundle
  - the stress playground remains an async component because it is diagnostic tooling
- The website now splits generic and specialized tab controls more cleanly:
  - `packages/website/src/PillControls.vue` is the reusable switcher for demo preset groups
  - the installation block keeps its original dedicated tab-strip styling
  - `packages/website/src/ComponentTabs.vue` remains a dedicated implementation with its own
    scrollable layout, overflow cue, and tooltip behavior
- The website component tabs now use horizontal overflow on narrow widths instead of shrinking until
  labels become cramped:
  - the tabs row remains a simple button strip
  - touch swipe/manual horizontal scroll is the fallback when the row no longer fits
  - native scrollbars stay hidden so the tab row does not gain an extra mobile separator
  - tab labels ellipsize instead of feeling abruptly clipped
  - a lightweight `More` cue and edge fades indicate hidden tabs until the user reaches the end
  - hover/focus tooltips are hidden on coarse or narrow viewports where the scroll container would
    otherwise clip them
- Vercel deployment settings now live in the Vercel project dashboard instead of `vercel.json`:
  - production branch is `main`
  - install uses Corepack plus the pinned `pnpm@10.33.0`
  - build runs the root monorepo build
  - output comes from `packages/website/dist`
  - the legacy `vue-clamp.vercel.app` hostname is handled separately through a tiny redirect-only
    Vercel project/repo rather than restoring long-term Vercel config to this repo
- Generated deployment runtime state is not source config:
  - `.wrangler/` is ignored and should not be committed
  - Git-tracked deployment behavior should come from authored Vite/Void config instead
- The website is intentionally a plain Vue SPA even though it deploys through the Void CLI:
  - [packages/website/vite.config.ts](/Users/yiling.gu@konghq.com/Developer/Justineo/vue-clamp/packages/website/vite.config.ts) exports a plain Vite config object and uses only the Vue plugin, not `voidPlugin()`
  - `void@0.7.1` is installed as a normal website dev dependency from the public npm registry
  - [packages/website/void.json](/Users/yiling.gu@konghq.com/Developer/Justineo/vue-clamp/packages/website/void.json) explicitly sets `inference.appType: "spa"` and `inference.outputDir: "dist"`
  - this keeps the build output in the standard Vite SPA layout and avoids the extra `dist/client` / `dist/ssr` split that was previously causing deploy confusion
- GitHub automation now follows a three-lane automation model:
  - `.github/workflows/ci.yml` is the validation workflow, publishes preview builds for
    `packages/vue-clamp` with `pkg-pr-new`, and on `push` to `main` also deploys
    `packages/website` to the Void project from the same validated workspace.
  - That main-branch deploy path uses the installed public npm `void` binary from
    `packages/website` and runs `vp exec void deploy --skip-build --project vue-clamp` with
    `VOID_TOKEN`, so CI does not depend on a checked-in `.void/project.json`.
  - `.github/workflows/release.yml` publishes tagged releases from `v*` tags after running the full
    validation/build pipeline, uses the matching `CHANGELOG.md` section as the GitHub release body,
    and uses npm trusted publishing plus prerelease dist-tags derived from the tag name.
- The repo no longer uses GitHub Packages or private scoped packages for Void deployment.
- Renovate dependency automation is intentionally weekly but stability-gated:
  - branch creation is allowed only on Tuesdays in the `Asia/Shanghai` timezone so dependency
    update work stays batched to one weekly window
  - package updates must still satisfy `minimumReleaseAge: "7 days"` before PR creation, accepting
    that frequently published packages can wait more than one week
  - non-major updates are grouped as `all non-major dependencies` and may automerge only through a
    PR after status checks pass
  - major updates stay separate and require manual review
- Browser test and benchmark configs live at the repo root:
  - the root package owns the `vp run test:browser` and `vp run benchmark:wrap` scripts, so it
    also declares `@vitejs/plugin-vue` and owns the corresponding browser-only Vite configs
  - those root configs must not import the website's typed `defineConfig(...)` object, because that
    forces TypeScript to compare root-owned `UserConfig` types against website-owned plugin and
    browser-provider types, which previously caused intermittent CI-only `TS2322` / `TS2321`
    failures
  - instead, the root configs import only plain shared fragments from
    `packages/website/vite.shared.ts` such as the `vue-clamp` alias and `publicDir`
  - keeping the configs under `packages/website/` turned out to be runtime-fragile: Vitest browser
    sessions would connect but never start tests when the config lived in the website package while
    the browser suites themselves lived under `packages/vue-clamp/tests`
- Browser test and benchmark configs intentionally reuse the website's Vue plugin, alias setup, and
  public assets without the website's `voidPlugin()` because the plugin enables a Cloudflare Worker
  environment that is incompatible with Vitest browser startup.
- Workspace packages that import `vite-plus` should declare `@types/node` explicitly in their own
  `devDependencies`:
  - `packages/vue-clamp` and `packages/website` each have importer-local `node_modules` symlinks
    created by pnpm
  - if only the workspace root declares `@types/node`, pnpm can satisfy the package importers with
    a second peer-instantiated `vite-plus` tree using a different `@types/node` version
  - that split is enough to make `@voidzero-dev/vite-plus-core` and
    `@voidzero-dev/vite-plus-test` types incompatible inside one TypeScript program, which breaks
    explicit `UserConfig` typing in shared browser config files even though the runtime config is
    otherwise valid
- Local release prep now goes through `vp run release`, which delegates to `bumpp` directly
  against `packages/vue-clamp/package.json`:
  - only `packages/vue-clamp/package.json` is versioned
  - `bumpp` enforces a clean worktree through `gitCheck`
  - `bumpp` creates the release commit/tag/push for the existing tag-driven GitHub publish workflow
  - release-note extraction and final publish validation live in `.github/workflows/release.yml`
    through `releaselog`, `vp check`, `vp test`, browser tests, and build steps
- Release documentation now lives in:
  - `CHANGELOG.md` for versioned release notes
  - changelog entries are written from the library user's point of view: observable behavior,
    compatibility, upgrade cost, performance, or reliability only; internal mechanics and benchmark
    tooling stay out unless users must act on them
  - `MIGRATION.md` for `0.x` -> `1.x` migration guidance
  - `packages/vue-clamp/README.md` as a brief npm-facing entry point that sends users to the
    website for full docs and demos
- `README.md` at the repo root stays repo-facing:
  - short package summary
  - links to the website and package docs
  - local development commands
- Validation standard:
  - `vp install`
  - `vp check`
  - `vp test`
  - `vp run test:browser`
  - `vp run build`
- The root `build` script intentionally uses a Vite+ filter instead of a raw recursive run:
  - it runs `vp run -F website... build`
  - the `website...` filter selects the website package plus its workspace dependencies, so
    `vue-clamp#build` runs before `website#build`
  - do not restore `vp run build -r`; with the current Vite+ runner syntax that command exits
    successfully with `0 tasks`, which skips both the package build and the website build
  - do not use `vp run -r build` while the root package has its own `build` script, because it
    selects the root and duplicates the workspace build tasks
- Browser coverage focuses on:
  - component contract tests
  - demo-page regressions
  - width-sweep regressions
  - browser-fit checks around slots, inherited widths, and `maxHeight`
- Browser runs suppress Chromium's
  `ResizeObserver loop completed with undelivered notifications.` signal in browser test and
  browser benchmark configs by filtering Vite's browser-environment logger.
  - this is a test-output filter for the platform-defined ResizeObserver notification error, not a
    clamp runtime scheduling change
  - do not defer runtime `ResizeObserver` reclamps just to quiet test output; that can leave stale
    clamped DOM visible for a paint after external layout changes
  - the previous `setupFiles`-based suppression attempt was removed because it only downgraded the
    event into terminal `console.error` noise instead of truly suppressing it
