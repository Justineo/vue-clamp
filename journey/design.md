# Vue Clamp Vue 3 Rebuild

## Context

- The `main` branch started from a fresh Vite+ workspace scaffold and does not contain the old library implementation.
- The migration baseline is the Vue 2 `0.4.1` implementation on `master`.
- The package now ships four Vue 3 clamp surfaces:
  - `LineClamp` for multiline DOM-driven clamping
  - `RichLineClamp` for multiline trusted-inline-html clamping
  - `InlineClamp` for measured one-line affix-friendly truncation
  - `WrapClamp` for wrapped atomic-item clamping

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
- Public declaration types live in `packages/vue-clamp/src/types.ts`.
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
    generation, text clamp search, location normalization, and native one-line eligibility helpers
  - `packages/vue-clamp/src/rich.ts` for rich-text parsing, runtime inline-flow classification,
    logical-run preprocessing, boundary slicing, and rich clamp search
  - `packages/vue-clamp/src/layout.ts` for the remaining shared primitives worth centralizing:
    line-limit normalization, CSS length normalization, combined size signatures, and fit checks
- `packages/vue-clamp/src/LineClamp.ts` now owns only text behavior:
  - reactive `visibleText`
  - text preparation and native one-line fast path dispatch
  - text accessibility handling for rewritten visible output
- `packages/vue-clamp/src/RichLineClamp.ts` now owns only rich-html behavior:
  - visible/probe rich DOM decisions and rich fallback state
  - hidden probe setup for rich measurement
  - the visible rich HTML is patched directly into the shared `body` part
  - no image-load settlement; inline rich images must provide stable layout dimensions up front
- Shared code stays in small helpers instead of a large base shell.
- `LineClamp` and `RichLineClamp` now share one narrow internal shell helper rather than
  duplicating the same lifecycle shell:
  - root/content/body/before/after refs
  - controlled `expanded` syncing and `clamped` emission
  - queued recomputes
  - resize/font invalidation
  - same-flush `onUpdated` invalidation
  - the actual clamp logic still stays local to each component
- `InlineClamp` is a small measured single-line component:
  - one `inline-block` root that clips to its available width
  - optional fixed `start` and `end` segments in normal inline flow
  - one rewritten `body` segment found by boundary-aware binary search against the live inline
    content
  - `location` shares the `LineClamp` keyword/ratio semantics and applies only inside the
    rewritten `body`; split `start` and `end` segments remain fixed
  - each clamp pass restores the full body text before reading the root width, so a previously
    shortened inline-block root does not become the stale width limit when the parent grows
  - custom `ellipsis` is inserted by JS, so the rewritten body can shrink to only the ellipsis
  - segment text stays in normal inline flow, so spaces follow standard browser whitespace
    collapsing instead of a component-specific preservation path
  - `ResizeObserver` and font-load invalidation keep the measured result current
  - width-only reclamps reuse the shared boundary-aware warm-start search helper
  - no slots or exposed instance API
- `WrapClamp` is item-driven and browser-aligned:
  - one root clamp container with live DOM measurement
  - one inline-flex wrapping flow of atomic item shells
  - optional `before` / `after` atomic slot shells
  - reactive `visibleCount`, `expanded`, and `isClamped`
  - no public strategy prop or cache-backed variant
  - no partial clipping inside an item

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
    - parsed rich preprocessing now caches text boundary metadata once per `html` source and reuses
      it across width, slot, and font reclamps
    - rich preparation no longer carries its own support flag; support is decided only from the
      rendered layout at clamp time
    - unchanged content still validates the rendered rich layout, but now exits before logical-run
      construction when the full source already fits
    - fit probes now patch a persistent hidden probe tree instead of mutating the visible rich body
    - width-only visible commits patch a prefix-preserving suffix from the prepared source instead
      of using `innerHTML`
    - structural patches clone only the changed suffix under the shared patch anchor, so unchanged
      prefix descendants such as images are not recreated during width-only reclamps
    - hidden-probe images use an inert data URI source while preserving sizing attributes/styles, so
      probe-only candidate churn does not repeatedly fetch remote image URLs
    - inline rich images must have a deterministic layout size before loading; responsive
      resource selection is not preserved inside the hidden probe because measurement depends only
      on the image box
    - rich search now derives warm-start hints from the previous structural decision for nearby
      width changes; the hidden probe's current patch state and the search hint are separate so
      large width jumps can cold-search without resetting or repainting the visible tree
  - sanitization stays the caller's responsibility
  - the runtime measures rich candidates in a connected hidden probe so the visible rich subtree is
    not mutated during binary search
- `before` and `after` slots render directly into the same inline flow and are observed for size changes via `ResizeObserver`.
- `WrapClamp` treats each item as an atomic box and uses a single visible-DOM clamp engine:
  - collapsed states are measured from the real rendered `before` / items / `after` sequence
  - the engine settles by shrinking to a fitting prefix, then probing upward one item at a time
  - measurements come from the rendered content DOM directly instead of a separate per-item ref cache
  - keep item order logical in the DOM so RTL works through inherited browser direction

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
  - shared multiline shell behavior lives in `multiline.ts`
  - text behavior lives in `text.ts`
  - rich behavior lives in `rich.ts`
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
  - scope:
    - current `WrapClamp` workloads
    - current rich clamp workloads
  - method: repeated browser runs with stable-state timing

## Repo Standards

- Use Vite+ commands only.
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
  - the current targets are the page body, demo preview frames, and code blocks
  - `ComponentTabs` stays on its native horizontal scroller so its bespoke mobile overflow behavior
    remains independent from the shared scrollbar layer
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
  - [packages/website/vite.config.ts](/Users/yiling.gu@konghq.com/Developer/Justineo/vue-clamp/packages/website/vite.config.ts) uses only the Vue plugin, not `voidPlugin()`
  - the website does not keep `void` in normal workspace dependencies; deployment installs a pinned CLI on demand instead
  - [packages/website/void.json](/Users/yiling.gu@konghq.com/Developer/Justineo/vue-clamp/packages/website/void.json) explicitly sets `inference.appType: "spa"` and `inference.outputDir: "dist"`
  - because `void` is no longer installed locally by default, `void.json` no longer points at `./node_modules/void/schema.json`
  - this keeps the build output in the standard Vite SPA layout and avoids the extra `dist/client` / `dist/ssr` split that was previously causing deploy confusion
- GitHub automation now follows a three-lane automation model:
  - `.github/workflows/ci.yml` is the validation workflow, publishes preview builds for
    `packages/vue-clamp` with `pkg-pr-new`, and on `push` to `main` also deploys
    `packages/website` to the Void project from the same validated workspace.
  - That main-branch deploy path keeps the normal `setup-vp` install free of private GitHub
    Packages dependencies, writes the `@void-sdk` `.npmrc` only for the deploy-time steps, runs
    `vp dlx @void-sdk/void@0.2.2 staging off` because `void@0.2.2` defaults to staging mode in a
    fresh environment, and deploys from `packages/website` via
    `vp dlx @void-sdk/void@0.2.2 deploy --skip-build` with `VOID_TOKEN` plus the explicit
    `VOID_PROJECT=vue-clamp` override so CI does not depend on a checked-in `.void/project.json`.
  - `.github/workflows/release.yml` publishes tagged releases from `v*` tags after running the full
    validation/build pipeline, uses the matching `CHANGELOG.md` section as the GitHub release body,
    and uses npm trusted publishing plus prerelease dist-tags derived from the tag name.
- Private GitHub Packages access is now deploy-only:
  - routine installs, checks, tests, release validation, Dependabot, and Renovate do not need the
    private `@void-sdk/void` package in the workspace graph
  - GitHub Actions writes the temporary `@void-sdk` `.npmrc` only around the deploy-time `vp dlx`
    steps and sources auth from the `PACKAGES_READ_TOKEN` secret
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
- Browser runs can still print the Chromium
  `ResizeObserver loop completed with undelivered notifications.` noise through Vite's client error
  catcher.
  - this is currently non-fatal and does not block the suite from completing
  - the previous `setupFiles`-based suppression attempt was removed because it only downgraded the
    event into terminal `console.error` noise instead of truly suppressing it
  - do not reintroduce browser-runner patches for this unless they are proven to run before
    Vitest's own error catcher
