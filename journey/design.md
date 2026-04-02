# Vue Clamp Vue 3 Rebuild

## Context

- The `main` branch started from a fresh Vite+ workspace scaffold and does not contain the old library implementation.
- The migration baseline is the Vue 2 `0.4.1` implementation on `master`.
- The package now ships a single Vue 3 clamp component again. The extra legacy and benchmark surfaces were removed because they increased maintenance cost without enough product value.

## Product Goals

- Ship a Vue 3-only `vue-clamp` package with precise TypeScript types.
- Preserve the `0.4.1` component semantics where they still make sense, while simplifying the public surface:
  - `as`
  - `autoresize`
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

- The publishable package exports a single named component entry: `Clamp` from `vue-clamp`.
- There is no default export.
- Public types remain `ClampProps`, `ClampExposed`, `ClampSlotProps`, and `ClampLocation`.
- Public declaration types live in `packages/vue-clamp/src/types.ts`.
- The clamped source content comes from the `text` prop.
- `before` and `after` remain rich Vue slots.

### Runtime model

- The implementation is DOM-driven and browser-aligned.
- `packages/vue-clamp/src/component.ts` is now the real center of gravity:
  - prop and emit definitions
  - DOM measurement
  - line/height fit checks
  - resize and font listeners
  - render tree
  - exposed methods
- The only remaining nontrivial helper module is `packages/vue-clamp/src/text.ts`, which owns grapheme splitting and kept-count text generation. It stays separate because the component and browser tests both use it.
- Small single-use helper modules that only fragmented the runtime were removed.
- The component now keeps only the minimum moving pieces:
  - reactive `visibleText`, `expanded`, and `isClamped`
  - DOM refs for root/content/text and optional `before`/`after` slot wrappers

### Clamp strategy

- The actual clamp pass:
  - starts from the `text` prop
  - measures the live content width from the rendered root
  - normalizes `maxLines` and `maxHeight`
  - splits the source text into graphemes
  - binary-searches the kept grapheme count directly against the live DOM
  - uses the browser as the source of truth for wrapping and overflow
- `before` and `after` slots render directly into the same inline flow and are observed for size changes via `ResizeObserver`.

### Reactivity and trade-offs

- The component recalculates on:
  - width changes when `autoresize` is enabled
  - slot size changes
  - text changes
  - relevant prop changes
  - font readiness events when available
- The component intentionally stays close to the naive Vue 2 model:
  - no hidden-first-paint gate
  - no probe element
  - no detached measurement host
  - no synthetic line-height-derived clipping guardrail
- The deliberate trade-off is that async resize/font transitions may briefly show stale or unclamped text before the next DOM-driven recompute settles.
- In exchange, correctness does not depend on line-height modeling and the runtime is much easier to follow.

## Constraints and Trade-offs

- The component now requires a `text` prop for the clamped source content.
- The implementation favors browser truth over a mathematically modeled layout engine.
- A small amount of duplicated logic inside the component is preferred over splitting one runtime path across many files.
- Browser tests are still the main confidence layer because the component’s behavior depends on real DOM layout.

## Repo Standards

- Use Vite+ commands only.
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
