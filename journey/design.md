# Vue Clamp Vue 3 Rebuild

## Context

- The `main` branch started from a fresh Vite+ workspace scaffold and does not contain the old library implementation.
- The migration baseline is the Vue 2 `0.4.1` implementation on `master`.
- The package now ships three Vue 3 clamp surfaces:
  - `LineClamp` for multiline DOM-driven clamping
  - `InlineClamp` for native one-line affix-friendly truncation
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
  - `InlineClamp` as the canonical single-line native component name
  - `WrapClamp` as the canonical wrapped-item component name
- There is no default export.
- Public declaration types live in `packages/vue-clamp/src/types.ts`.
- `LineClamp` keeps the existing `text`-based multiline clamp API.
- `LineClamp` `location` accepts the keyword aliases `start`, `middle`, and `end`, plus numeric ratios from `0` to `1`.
- `LineClamp` `before` and `after` remain rich Vue slots.
- Empty `before` / `after` slot output is filtered at the VNode level so empty arrays, comment-only results, and whitespace-only text do not leave wrapper elements behind.
- Stable internal styling hooks use `data-part` only:
  - `LineClamp`: `root`, `content`, `before`, `body`, `after`
  - `InlineClamp`: `root`, `start`, `body`, `end`
  - `WrapClamp`: `root`, `content`, `before`, `item`, `after`
- DOM nesting is intentionally not part of the styling contract.
- `InlineClamp` is native-only and single-line-only.
- `InlineClamp` accepts:
  - `text`
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
- `packages/vue-clamp/src/LineClamp.ts` is now the real center of gravity for the multiline component:
  - prop and emit definitions
  - DOM measurement
  - line/height fit checks
  - resize and font listeners
  - render tree
  - exposed methods
- The only remaining nontrivial helper module for multiline clamping is `packages/vue-clamp/src/text.ts`, which owns grapheme splitting and kept-count text generation. It stays separate because the component and browser tests both use it.
- Small single-use helper modules that only fragmented the runtime were removed.
- `LineClamp` now keeps only the minimum moving pieces:
  - reactive `visibleText`, `expanded`, and `isClamped`
  - DOM refs for root/content/text and optional `before`/`after` slot wrappers
  - a per-instance prepared-text cache keyed by `text`
- `InlineClamp` is much narrower:
  - one root inline-flex container
  - optional fixed `start` and `end` segments
  - one shrinking `body` segment with native `text-overflow: ellipsis`
  - the `body` keeps at least an ellipsis-width minimum so native truncation still has room to render
  - leading and trailing plain-space runs inside split segments are rendered through preserved-space
    inline children so boundary spaces do not disappear across segment boxes
  - no JS text rewriting, slots, or exposed instance API
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

### Clamp strategy

- The actual clamp pass:
  - starts from the `text` prop
  - normalizes `location` to an internal ratio before clamp rendering
  - prepares grapheme boundary offsets once per source text and reuses them across width/slot/font reclamps
  - measures the live content width from the rendered root
  - normalizes `maxLines` and `maxHeight`
  - refreshes the visible root clip box during each `maxHeight` fit probe so reactive height increases can expand the visible text correctly
  - uses a native CSS overflow fast path for the collapsed single-line end case when the default `…` ellipsis is used and the normalized location ratio is `1`
  - in that native path, `before` and `after` stay as fixed inline-flex items while the text cell becomes the only flexible width consumer
  - otherwise binary-searches the kept grapheme count directly against the live DOM
  - uses the browser as the source of truth for wrapping and overflow in both paths
- `before` and `after` slots render directly into the same inline flow and are observed for size changes via `ResizeObserver`.
- `WrapClamp` treats each item as an atomic box and uses a single visible-DOM clamp engine:
  - collapsed states are measured from the real rendered `before` / items / `after` sequence
  - the engine settles by shrinking to a fitting prefix, then probing upward one item at a time
  - measurements come from the rendered content DOM directly instead of a separate per-item ref cache
  - keep item order logical in the DOM so RTL works through inherited browser direction

### Reactivity and trade-offs

- The component recalculates on:
  - root width changes
  - slot size changes
  - text changes
  - relevant prop changes
  - font readiness events when available
- `WrapClamp` follows the same philosophy:
  - root/content/slot size changes
  - item source changes
  - relevant prop changes
  - font readiness events when available
- `WrapClamp` keeps only one queued recompute loop per instance and deduplicates observer-driven work against the last settled observed-geometry signature.
- `LineClamp` and `WrapClamp` now treat `ResizeObserver` as part of the required browser baseline instead of carrying runtime existence fallbacks.
- Removing that settled-signature guard was measured and rejected:
  - single-line benchmark:
    - `176` -> `212` `getBoundingClientRect()` calls
    - `68` -> `76` item slot calls
    - `129.5ms` -> `127.7ms` median total, effectively flat
  - table benchmark:
    - `16700` -> `28300` `getBoundingClientRect()` calls
    - `15300` -> `23300` item slot calls
    - `310.3ms` -> `392.9ms` median total
- The component intentionally stays close to the naive Vue 2 model:
  - no hidden-first-paint gate
  - no probe element
  - no synthetic line-height-derived clipping guardrail
- The deliberate trade-off is that async resize/font transitions may briefly show stale or unclamped text before the next DOM-driven recompute settles.
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

- The component now requires a `text` prop for the clamped source content.
- The implementation favors browser truth over a mathematically modeled layout engine.
- In the native single-line fast path, the collapsed DOM text remains the full source text and the visual ellipsis comes from CSS overflow rather than a rewritten text node.
- Custom ellipsis strings still fall back to the JS trimming path.
- The JS trimming path still rewrites the visible text node, but accessibility now comes from the hidden full-text sibling rather than a generic-element label.
- A small amount of duplicated logic inside the component is preferred over splitting one runtime path across many files.
- `WrapClamp` stays data-driven with `items`; arbitrary child-vnode introspection is intentionally out of scope for v1.
- `WrapClamp` follows live DOM measurement for every clamp mode.
- `maxLines="1"` is still the lightest case, but there is no separate predictive one-line engine.
- Browser tests are still the main confidence layer because the component’s behavior depends on real DOM layout.
- The repo now also has a dedicated browser benchmark:
  - config: `vite.browser.benchmark.config.ts`
  - script: `vp run benchmark:wrap`
  - scope: measure current `WrapClamp` workloads
  - method: repeated browser runs with stable-state timing

## Repo Standards

- Use Vite+ commands only.
- The website hero should lead with real use cases instead of component taxonomy. The animated line
  now rotates through a randomized but category-balanced set of concrete nouns from the multiline,
  inline, and wrapped-item surfaces, while the API names remain `LineClamp`, `InlineClamp`, and
  `WrapClamp`.
- GitHub automation now follows a two-lane publish model:
  - `.github/workflows/ci.yml` remains the validation workflow and also publishes preview builds for
    `packages/vue-clamp` with `pkg-pr-new`.
  - `.github/workflows/release.yml` publishes tagged releases from `v*` tags after running the full
    validation/build pipeline, uses the matching `CHANGELOG.md` section as the GitHub release body,
    and uses npm trusted publishing plus prerelease dist-tags derived from the tag name.
- Local release prep now goes through `vp run release`, which delegates to `bumpp` through
  `bump.config.ts`:
  - only `packages/vue-clamp/package.json` is versioned
  - `bumpp` enforces a clean worktree through `gitCheck`
  - `bumpp` creates the release commit/tag/push for the existing tag-driven GitHub publish workflow
  - release-note extraction and final publish validation live in `.github/workflows/release.yml`
    through `releaselog`, `vp check`, `vp test`, browser tests, and build steps
- Release documentation now lives in:
  - `CHANGELOG.md` for versioned release notes
  - `MIGRATION.md` for `0.x` -> `1.x` migration guidance
  - `packages/vue-clamp/README.md` for the npm-facing release and migration summary
- Validation standard:
  - `vp install`
  - `vp check`
  - `vp test`
  - `vp run test:browser`
  - `vp run build -r`
- Browser coverage focuses on:
  - component contract tests
  - demo-page regressions
  - width-sweep regressions
  - browser-fit checks around slots, inherited widths, and `maxHeight`
