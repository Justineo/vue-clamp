# Vue Clamp Vue 3 Rebuild

## Context

- The `main` branch started from a fresh Vite+ workspace scaffold and does not contain the old library implementation.
- The migration baseline is the Vue 2 `0.4.1` implementation on `master`.
- The package now ships two Vue 3 clamp surfaces:
  - `LineClamp` for multiline DOM-driven clamping
  - `InlineClamp` for native one-line affix-friendly truncation

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
  - `Clamp` as a compatibility alias of `LineClamp`
- There is no default export.
- Public declaration types live in `packages/vue-clamp/src/types.ts`.
- `LineClamp` keeps the existing `text`-based multiline clamp API.
- `LineClamp` `location` accepts the keyword aliases `start`, `middle`, and `end`, plus numeric ratios from `0` to `1`.
- `LineClamp` `before` and `after` remain rich Vue slots.
- `InlineClamp` is native-only and single-line-only.
- `InlineClamp` accepts:
  - `text`
  - optional `split(text) => { start?, body, end? }`
  - `as`

### Runtime model

- `LineClamp` is DOM-driven and browser-aligned.
- `packages/vue-clamp/src/component.ts` is now the real center of gravity for the multiline component:
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
  - no JS text rewriting, slots, or exposed instance API

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

### Reactivity and trade-offs

- The component recalculates on:
  - root width changes
  - slot size changes
  - text changes
  - relevant prop changes
  - font readiness events when available
- The component intentionally stays close to the naive Vue 2 model:
  - no hidden-first-paint gate
  - no probe element
  - no detached measurement host
  - no synthetic line-height-derived clipping guardrail
- The native fast path deliberately stays narrow so the component still has one readable runtime and does not need a separate slot-aware single-line layout engine.
- The deliberate trade-off is that async resize/font transitions may briefly show stale or unclamped text before the next DOM-driven recompute settles.
- In exchange, correctness does not depend on line-height modeling and the runtime is much easier to follow.

## Constraints and Trade-offs

- The component now requires a `text` prop for the clamped source content.
- The implementation favors browser truth over a mathematically modeled layout engine.
- In the native single-line fast path, the collapsed DOM text remains the full source text and the visual ellipsis comes from CSS overflow rather than a rewritten text node.
- Custom ellipsis strings still fall back to the JS trimming path.
- The JS trimming path still rewrites the visible text node, but accessibility now comes from the hidden full-text sibling rather than a generic-element label.
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
