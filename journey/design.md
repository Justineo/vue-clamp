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
  - ResizeObserver callbacks observe the border box and compare reported subpixel border-box sizes
    for the signature elements against the last synchronous layout signature, so settled
    self-notifications do not need fresh layout reads while external container and slot-size changes
    still schedule reclamps
  - ResizeObserver entries refresh the shell's cached border-box signatures before scheduling a
    reclamp; RichLineClamp reuses those observed affix signatures for hidden-probe clone validation
    instead of rereading affix wrapper bounding rects on every width-only pass
  - when `onUpdated` or a root ResizeObserver entry already provides the current subpixel root
    width, the shell passes that width into Line/Rich recompute callbacks so the clamp pass does not
    reread the same root bounding rect; recompute paths without a fresh snapshot still measure the
    root directly
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
  multiline reuses the shell's fresh subpixel root width as the unmeasurable-layout guard when that
  snapshot is available, then compares scroll height against client height. Native single-line still
  reads the text cell's own client width because affix slots can make it narrower than the root.
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
  - custom `ellipsis` is inserted by JS, so the rewritten body can shrink to only the ellipsis
  - segment text stays in normal inline flow, so spaces follow standard browser whitespace
    collapsing instead of a component-specific preservation path
  - clamp search writes the final body text into the live DOM node, and a shallow visible-body
    snapshot triggers Vue only when the hidden full-text accessibility structure must appear or
    disappear; clamped-to-clamped width churn therefore avoids a second Vue text patch
  - warm clamped resize passes may skip the separate full-body `scrollWidth` probe when the
    previous body clamp used the same boundary offsets and the root has not grown beyond the small
    local-search window; the full body still participates as a candidate inside the warm search, so
    small grows can recover the source text
  - inline candidate probes route body text writes through a small local guard, matching the shared
    text helper's behavior and avoiding no-op `textContent` mutations when the current candidate is
    already rendered
  - `ResizeObserver` and font-load invalidation keep the measured result current
  - parent/root layout invalidation uses subpixel border-box signatures, and ResizeObserver
    callbacks compare `borderBoxSize` entries against the last settled signature so fractional
    width changes are not lost to integer offset rounding
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
  - refreshes the visible root clip box during each `maxHeight` fit probe so reactive height increases can expand the visible text correctly
  - uses a native CSS overflow fast path for the collapsed single-line end case when `boundary` is
    `"grapheme"`, the default `…` ellipsis is used, and the normalized location ratio is `1`
  - in that native path, `before` and `after` stay as fixed inline-flex items while the text cell becomes the only flexible width consumer
  - otherwise binary-searches the kept boundary count directly against the live DOM
  - width-only reclamps warm-start from the last kept boundary count when the prepared boundary
    offsets still match, then do a bounded local expansion before binary searching, so continuous
    resize does not always restart from the middle of the whole text while large jumps stay close to
    cold-search cost
  - measured text results carry the root width that produced them, so later layout passes can ignore
    a stale warm hint after large width jumps without the component keeping a parallel width cache
  - warm resize passes that are still clearly clamped may skip the separate full-source fit probe
    and let the candidate search include the full-source candidate instead; this removes one
    visible text mutation and one fit read from stable affix scenarios without changing the cold
    path or full-fit detection for large grows
  - measured clamped-to-clamped commits leave the final text mutation from the search pass in place
    and update only a non-triggering shallow snapshot, so width churn does not call affix slots or
    patch the component tree again unless the hidden-source accessibility wrapper or clamped slot
    state must change
  - text and rich fit probes can use a rect-count shortcut when only `maxLines` is active: if the
    content fragment count is already no larger than the line limit, the candidate fits without
    allocating and comparing grouped line boxes
  - `maxHeight` fit probes measure the root's viewport top once per clamp pass and reuse it across
    candidate checks; each candidate still reads the current root client height so shrinking
    candidates remain accurate without paying a root bounding-rect read per probe
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
    - unchanged content exits before rendered-layout inspection and logical-run construction when
      the full source already fits, because no searchable rich layout model is needed for an
      unclamped result
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
    - rich candidate checks share the text helper's conservative rect-count fit shortcut when
      `maxHeight` is absent; `maxHeight` still uses the full visible-bounds path
    - width-only visible commits patch a prefix-preserving suffix from the prepared source instead
      of using `innerHTML`
    - structural patches clone only the changed suffix under the shared patch anchor, so unchanged
      prefix descendants such as images are not recreated during width-only reclamps
    - when a structural rich patch moves between two clamped cuts in the same source text node and
      the target text does not need trailing-whitespace normalization, the live text node is updated
      in place instead of rebuilding the same suffix; this path is guarded so the root-level
      ellipsis appended by the clamp algorithm is never mistaken for a source text node
    - hidden-probe images use an inert data URI source while preserving sizing attributes/styles, so
      probe-only candidate churn does not repeatedly fetch remote image URLs
    - inline rich images must have a deterministic layout size before loading; responsive
      resource selection is not preserved inside the hidden probe because measurement depends only
      on the image box
    - rich search now derives warm-start hints from the previous structural decision for nearby
      width changes; the hidden probe's current patch state and the search hint are separate so
      large width jumps can cold-search without resetting or repainting the visible tree
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
    cross-process browser drift. Single-target runs keep the original schema v3 payload.
  - duplicate target specifiers in a multi-target run are resolved once and then repeated in the
    browser target list. This keeps same-version noise checks such as `--targets current,current`
    from rebuilding or reinstalling the same package twice while preserving two report columns.
  - external package targets are installed into a system temporary directory instead of a path under
    the repo, because Vite+ treats subdirectories inside this repo as part of the workspace
  - package benchmark files call only public component APIs and must not import `packages/vue-clamp/src`
    or other package internals
  - native browser APIs are wrapped only as spies, then delegated to the original implementation, so
    layout remains real browser layout while counters expose broad regression signals
  - benchmark layout-read counters distinguish bounding rects, client rects, client box getters,
    and offset box getters; `offsetWidth` / `offsetHeight` are tracked explicitly because
    signature-style invalidation can otherwise hide a large amount of synchronous layout work
  - package timing uses schema v3 and keeps multiple signals:
    `updateMs` measures the width change through Vue flush, `activeMs` measures through the last
    root-local DOM mutation / ResizeObserver / Vue-flush activity, `totalMs` / `meanStepMs`
    preserve the previous width-change-through-stable timing, and `quietMs` isolates the
    conservative quiet-frame wait
  - package benchmark sampling is adaptive rather than a fixed three-run smoke and does not treat
    outer run count as the quality target. `VUE_CLAMP_BENCH_MODE=smoke` keeps quick local checks at
    1 warmup / 3 measured runs. The default report mode uses 1 warmup, at least 3 measured samples,
    at least 2 seconds of measured wall time per scenario, a 30-sample cap, and a 15s
    per-scenario wall budget. Strict mode uses 2 warmups, at least 5 measured samples, at least 5s
    measured wall time, a 50-sample cap, and a 30s per-scenario wall budget. This keeps the runtime
    predictable while still giving each scenario enough repeated samples to expose standard
    deviation. Override knobs are `VUE_CLAMP_BENCH_WARMUP_RUNS`, `VUE_CLAMP_BENCH_MIN_RUNS`,
    `VUE_CLAMP_BENCH_MAX_RUNS`, `VUE_CLAMP_BENCH_MIN_SCENARIO_MS`, and
    `VUE_CLAMP_BENCH_MAX_SCENARIO_MS`.
  - each package scenario summary includes sample count, mean, standard deviation, standard error,
    coefficient of variation, 95% margin of error, 95% relative margin of error, median absolute
    deviation, accumulated
    sampled active time, and sample wall time for numeric metrics. Median active time remains the
    primary comparison value because browser timings are noisy, but the report surfaces precision so
    a single red cell is not treated as a confirmed regression.
  - each package scenario logs a concise `BENCH_SCENARIO` line when it finishes, including version,
    target specifier, component, scenario, sample count, measured wall time, accumulated active time,
    median/mean active time, active standard deviation, active CV, and active RME. This makes long
    full-matrix and same-version A/B runs observable without waiting for the final JSON payload.
  - PerformanceObserver / browser scheduling diagnostics are captured as secondary evidence:
    long task count and duration, long animation frame count and duration when supported,
    requestAnimationFrame interval summaries, dropped frame estimates, and requestIdleCallback
    budget/opportunity counts
  - the cross-version runner uses the full public component matrix instead of a few smoke scenarios:
    LineClamp, InlineClamp, and RichLineClamp rows are chosen from user-facing shapes and stress
    cases first, not from the current optimizer branch map. The matrix covers single-line titles,
    multi-line summaries, CTA / metadata affixes, middle/start/end truncation, file-path split
    truncation, word-boundary copy, height-constrained cards, custom ellipsis markers, rich inline
    markup, fit/no-clamp cases, dense rich rows, and continuous/jitter/jump width changes. Some of
    those public scenarios are naturally eligible for native CSS paths in newer versions, but native
    eligibility is treated as an explanatory diagnostic outcome, not the sole reason a scenario
    exists.
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
  - report rendering also accepts schema v4 multi-target payloads emitted by same-process
    `--targets` runs; those payloads contain normal schema v3 report objects under `reports`, and
    the renderer flattens them before building the matrix. When multiple targets report the same
    package version, matrix columns use compact target labels instead of version-only keys so
    same-version A/B reports do not collapse distinct targets into one cell.
  - report rendering ignores unrelated `.log` files in the chosen log directory that do not contain
    a package benchmark marker, while still failing on malformed benchmark payloads. This lets local
    runs write renderer stdout/stderr next to benchmark logs without breaking report generation.
  - `VUE_CLAMP_BENCH_SCENARIOS` can filter package runs by exact scenario name, scenario group
    (`line`, `inline`, `rich`, or `wrap`), or component name; this is local optimization tooling for
    repeated hotspot loops and keeps full release-facing reports unfiltered by default
  - generated reports include both full-version absolute active-time matrices and adjacent-release
    delta summaries, so the output is not anchored only on the latest release pair
  - reports must distinguish speed from correctness coverage: when a release fixed missing reclamp
    triggers or incorrect output, older-version lower cost is not treated as a pure performance win;
    the Markdown report carries adjacent-release caveats for those behavior changes
  - adjacent-release SVG cells mark low-confidence timing deltas with `~` only when either side has
    active-time CV above 10%;
    those cells keep the normal direction color and add a top-right triangle marker because they are
    not strong evidence of an algorithmic regression or optimization by themselves
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
