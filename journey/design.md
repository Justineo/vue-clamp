# Vue Clamp Vue 3 Rebuild

## Context

- The `main` branch is a fresh Vite+ workspace scaffold and does not contain the old library implementation.
- The legacy implementation on `master` is version `0.4.1`, built for Vue 2, and its public contract is the migration baseline.
- The new implementation targets Vue 3 only and must preserve the component-level API of `0.4.1`: props, slot contract, imperative methods, and emitted events.
- The canonical external dependency for layout is `@chenglou/pretext`, specifically its low-level APIs for prepared text and line iteration.

## Product Goals

- Ship a Vue 3-only `vue-clamp` package with precise TypeScript types.
- Preserve the `0.4.1` behavior surface:
  - `tag`
  - `autoresize`
  - `maxLines`
  - `maxHeight`
  - `ellipsis`
  - `location`
  - `expanded`
  - `before` and `after` slots with `{ expand, collapse, toggle, clamped, expanded }`
  - `update:expanded`
  - `clampchange`
  - imperative `expand`, `collapse`, and `toggle`
- Replace the legacy DOM binary-search engine with a Pretext-driven layout core.
- Provide a demo site under `packages/website` that closely mirrors the legacy demo's structure and visual language.
- Add CI and Renovate so the repo is production-ready.

## Core Design Decisions

### Component model

- The package exports a single default Vue 3 component named `vue-clamp`.
- The component is implemented in TypeScript with the Composition API and an explicit public instance type for template refs.
- The exported component/value names intentionally avoid a `Vue*` prefix. The public value/type surface is `Clamp`, `ClampProps`, `ClampExposed`, `ClampSlotScope`, and `ClampLocation`.
- The declaration-only public types are centralized in `packages/vue-clamp/src/types.ts`; engine-private types stay in `clamp.ts`.
- The root package surface is intentionally component-focused: default export, component/value types, and the public `ClampLocation` type. Internal clamp-engine helpers are no longer re-exported from the package root.
- The default slot remains plain text only. This matches the legacy contract and keeps the Pretext engine tractable.

### Layout strategy

- Pretext is the primary text layout engine.
- The clamp result is computed from:
  - normalized text content
  - measured container width
  - resolved font shorthand
  - resolved line height
  - effective line limit derived from `maxLines` and/or `maxHeight`
  - measured widths of `ellipsis`, `before`, and `after`
- `before` is modeled as width consumed on the first visible line.
- `after` is modeled as width consumed on the last visible line.
- `location="end"`, `location="start"`, and `location="middle"` are all supported by computing the visible prefix and/or suffix against the Pretext line model.
- `location="middle"` now preserves the requested kept grapheme count exactly; legacy compatibility does not justify dropping one grapheme when the kept-count is odd.
- The current production implementation uses a pragmatic candidate search, but it no longer re-prepares the source text on every recompute.
- The production engine now:
  - keeps one prepared source handle per component instance for the stable `(trimmed text, font)` tuple
  - keeps prepared candidate handles only within that source instance, keyed by location, ellipsis, and kept grapheme count
  - keeps the last exact effective clamp input and result on that source so repeated identical calls can return immediately
  - skips `Intl.Segmenter` for conservative ASCII-safe source text and falls back to full grapheme segmentation for all other text
  - uses `layout()` for the slotless hot path
  - uses `walkLineRanges()` for the no-before-slot path that still needs last-line width
  - falls back to `layoutNextLine()` only for the atomic `before` slot path, because the exported Pretext API does not expose a start-cursor range walker

This keeps caching scoped to state Pretext does not already own internally, while letting width-only recomputes reuse prepared source and candidate work aggressively.
It also removes redundant recomputation when the effective clamp inputs are exactly unchanged, without weakening responsiveness to real text, width, slot, font, or limit changes.

### Slot handling

- `before` and `after` may contain rich Vue content, but they are handled as atomic inline boxes for the Pretext layout pass.
- The live slot DOM is measured with `ResizeObserver` and `getBoundingClientRect()`.
- If slot content wraps internally, the component still renders it, but clamp math assumes a single inline box. This is acceptable for the documented usage patterns and will be documented as a constraint.
- The `after` slot may depend on `clamped` or `expanded`; the component will use bounded multi-pass measurement to converge on a stable width.

### Measurement and reactivity

- A `ResizeObserver` is used for `autoresize`, slot width changes, and container width changes.
- DOM reads still exist, but only for inputs Pretext cannot infer by itself:
  - resolved fractional content-box width for the live container width
  - computed `font` and `line-height` for the text being measured
  - `getBoundingClientRect().width` for the atomic `before` and `after` slot boxes
- Live container width must not be rounded to integer `clientWidth` values. Fractional responsive widths can change the final visible line, and rounding them up can keep slightly too much text and spill one extra line.
- `fontShorthand()` is now treated as a guaranteed non-empty measurement helper, so callers do not carry extra empty-font guards.
- The implementation intentionally does not use DOM reads to discover whether text overflowed or how many lines the browser rendered; that work is handled by Pretext.
- The component recalculates on:
  - width changes
  - text changes
  - relevant prop changes
  - slot measurement changes
  - font readiness events when available
- Recompute scheduling is same-tick and coalesced with `queueMicrotask()`, not deferred to the next animation frame. This avoids visible stale frames during text swaps and resize-driven reclamps.
- When collapsed content changes, the component keeps the last settled rendered text until the next clamp result is ready instead of briefly swapping in the raw updated text.
- Collapsed `maxLines` also produces a derived CSS `max-height` once line height is known, so width changes stay visually clipped even before the final ellipsis text is committed.
- The derived line-based `max-height` must be adjusted for the root element's vertical border-box chrome. Without that offset, the last visible line is clipped early under `box-sizing: border-box`, which can make a valid ellipsis and inline `after` slot look missing or pushed outside the visible area.
- Source text is captured from the render-phase slot snapshot and synchronized in lifecycle hooks, rather than by invoking slots in setup or mutating reactive state from render.
- The settled source text used for clamp recomputation is plain component state, not Vue reactivity, because it does not participate in rendering directly.
- The current simplification pass removed repo-local prepared-text and grapheme caches, because they were duplicate policy around an engine that already caches internally or only needs per-computation segmentation.
- The first collapsed mount is now gated until the first measured clamp result is ready, so the component no longer visibly paints unclamped text before the initial client-side clamp settles.
- The gating strategy uses `visibility: hidden` during the initial unresolved collapsed render, which preserves layout space while avoiding the flash of full text.
- The initial hidden gate stays active until measurement actually succeeds; zero-width or otherwise unmeasurable first passes do not mark the component as ready.
- Initial `clampchange` emission is deferred until the first real clamp state is known, so collapsed mounts do not emit a spurious `false` before the first measured result.
- The main rendered text node now uses an explicit text accessibility hook rather than relying on a plain span with only `aria-label`.

### Packaging

- The workspace root stays private and becomes repository orchestration only.
- The publishable package lives in `packages/vue-clamp` and owns the `vue-clamp` package name.
- The demo site now lives alongside the library in `packages/website` and depends on the workspace package directly.
- The library itself is plain TypeScript; the website uses Vue SFCs with `@vitejs/plugin-vue`.
- The website intentionally keeps the legacy Spectre.css-based single-page demo layout instead of the earlier custom redesign so the Vue 3 rebuild still looks and reads like the historical project site.
- The website also exposes a benchmark view at `/?view=benchmark` that now compares only three live-browser benchmark engines:
  - the production Pretext implementation
  - an optimized DOM baseline that preserves legacy output semantics while removing redundant DOM work
  - the original legacy DOM-search baseline
- The DOM benchmark baselines now mirror the production middle-mode kept-count behavior as well, so the middle-clamp benchmark remains semantically comparable after the production correctness fix.
- The DOM comparison engines now live under `packages/vue-clamp/benchmark/dom/`, making it explicit that they are benchmark comparators rather than production paths.
- Benchmark code no longer lives under the library `src/` tree; it remains near the package but outside the publishable source path.
- The benchmark page is intentionally high-density:
  - a small header with only the essential controls
  - one compact engine summary table
  - one dense scenario matrix
  - Spectre-aligned table styling instead of a custom dashboard/report skin
  - typography now follows the Spectre site defaults rather than a benchmark-specific font stack
  - compact per-row bar charts are back as secondary visual guides
  - scenario rows can expand inline to reveal their detailed setup and a live representative fixture preview for the three compared engines
  - preview fixtures rerender on preview-width changes, so the shown clamp result tracks responsive layout changes instead of staying stale after first paint
  - table wrappers use a small Spectre-like border radius
  - visible performance ratios against Legacy DOM
  - raw `ops/s` available in tooltips instead of visible columns
- The benchmark page now treats Legacy DOM as the main historical reference baseline.
- The benchmark page is ratio-oriented rather than latency-oriented:
  - Legacy DOM is displayed as the `1.00x` baseline
  - the summary table shows geometric-mean speedup vs Legacy DOM
  - the scenario matrix shows only relative performance ratios for the three engines
- The benchmark runner/report has been simplified to match the page:
  - dead instrumentation counters were removed
  - unused parity/sample metadata was removed
  - the report keeps only methodology, per-scenario medians, winners, and summary wins
- The benchmark page no longer shows the old current-Pretext baseline, scenario descriptions, scenario tags, parity diagnostics, or expandable environment/raw-data sections.
- The benchmark page no longer uses the heavier report/dashboard framing from earlier iterations.
- The benchmark runner still enforces at least 9 macro runs per engine-scenario pair, so the page is slower to run than the earlier lightweight versions.
- Package metadata now points at the emitted `.d.mts` entry, so published type resolution matches the actual build output.
- The implementation has been simplified once already by splitting DOM measurement and slot-text extraction into dedicated modules, but benchmark-driven decisions such as fallback engines or broader architecture changes remain a follow-up item rather than settled direction.

## Constraints and Trade-offs

- Pretext requires accurate `font` and `line-height` values from computed styles; measurement must happen after mount.
- `maxHeight` depends on resolved line height and may only approximate CSS line-box behavior when side slots contain unusually tall inline content.
- The component will intentionally not support arbitrary rich content inside the default slot.
- The library favors deterministic Vue 3 behavior and type safety over backward compatibility with Vue 2 usage patterns such as `.sync`; Vue 3 consumers will use `v-model:expanded`, backed by the same `update:expanded` event.
- At this point, most of the remaining complexity is attached to real product constraints rather than surplus abstraction:
  - responsive width changes
  - rich `before` and `after` slot widths
  - string `maxHeight` support
  - font-load reclamping
  - no-flash collapsed updates
- The current code should not be treated as proof that every Pretext-based strategy is automatically best, but the redesigned production path has now crossed the bar where it materially outperforms both the optimized DOM baseline and the original Pretext integration in the main workloads it was designed for.
- The latest browser benchmark currently shows Pretext winning most scenarios, with the two DOM baselines only retaining a couple of narrow wins.
- The largest remaining Pretext gap is still text-update-heavy work, not width-driven relayout.

This means the architecture decision is no longer speculative: a Pretext-based production engine is justified here, but its remaining weakness is text churn rather than relayout churn.

- The benchmark remains an engine-level browser benchmark, not a universal proof across every browser or every future algorithm.
- The old current-Pretext comparison path has been removed from the page because it is no longer a decision-relevant implementation candidate.
- The redesigned production engine remains the main implementation, while the DOM paths now serve only as performance comparators.
- The benchmark browser globals now expose the leaner report shape rather than the older instrumentation-heavy one.
- The internal benchmark adapters are intentionally collapsed-path only; they no longer carry an unused `expanded` option.

## Repo Standards

- Use Vite+ commands only.
- Validation standard is `vp check` and `vp test`.
- CI should run install, check, test, and build/pack on supported Node versions.
- Renovate should run weekly, group minor and patch updates, and keep majors separate.
- Unit coverage is split intentionally:
  - clamp math and location behavior run in Node against deterministic Pretext inputs, with a small `OffscreenCanvas` shim for measurement
  - all rendered/component tests now run only in the Chromium browser suite, not jsdom
  - the browser suite lives in `vite.browser.config.ts` and is run separately via `vp run test:browser`; it covers both the component contract and width-sweep regressions against the real rendered component, including 1px shrink/grow sweeps and per-frame visible-line assertions for representative benchmark-style scenarios
