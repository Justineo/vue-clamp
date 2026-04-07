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
  - `vp run build -r`
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
