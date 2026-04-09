# 2026-04-08

- Started from `journey/design.md` plus `journey/research/211-rich-text.md`.
- Confirmed the current `LineClamp` runtime is still a text-only DOM-driven clamp with a native
  one-line fast path and accessibility-only hidden source text for rewritten string output.
- Planned the rich-text work around the research direction:
  - add `html` as an alternate source prop
  - keep the existing shell and slot model
  - support only inline rich content plus atomic `img` / outer `svg`
  - clamp only at `location="end"` in `html` mode
  - render original HTML unchanged when the content is unsupported or cannot be clamped safely
- Implemented the runtime in two layers:
  - `packages/vue-clamp/src/rich.ts` now owns HTML parsing, supported-subset preparation,
    rich-prefix materialization, and computed-layout validation
  - `packages/vue-clamp/src/LineClamp.ts` now runs a shared queued recompute loop for both source
    modes, keeps the existing native one-line text fast path, and adds `html`-mode fallback/warn
    behavior plus image-load recomputes
- Public API/doc updates:
  - added `html?: string` to `LineClampProps`
  - updated the package README, root README, changelog, website API reference, and live line demo
  - switched the website's `LineClamp` example block to a rich-html example and added a dedicated
    rich-html demo panel with trusted-html guidance
- Browser coverage added for:
  - preserved inline rich markup during clamp
  - unsupported structural/content-layout fallback
  - `html`-wins-over-`text` warnings
  - end-only `location` enforcement in `html` mode
  - website rich-html demo and API summary visibility
- Verified:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
  - `vp run build -r`
- Residual note:
  - browser runs still emit the pre-existing `ResizeObserver loop completed with undelivered
notifications.` noise through Vite's client error catcher, but the suite passes and this work
    did not introduce a new failing browser condition.
