# Truncation granularity log

Date: 2026-04-30

## Implementation

- Added public `ClampBoundary = "grapheme" | "word"` and a shared `boundary` prop for
  `LineClamp`, `RichLineClamp`, and `InlineClamp`.
- Generalized `text.ts` so all text surfaces use the same boundary preparation and measured search
  logic.
- `boundary="word"` uses `Intl.Segmenter` word boundaries and carries grapheme fallback offsets.
  Fallback is used only when no whole-word candidate fits.
- Native one-line `text-overflow` is now gated on `boundary === "grapheme"`; word mode always uses
  JS measurement.
- Rich clamping now names internal text cut points generically and applies the same word/fallback
  behavior inside supported text runs.

## Docs and demo

- Documented `boundary` in the package README.
- Added Boundary controls to the LineClamp location demo, RichLineClamp shared demo controls, and
  InlineClamp shared demo controls.
- Added website API entries for all three text-based components.

## Verification so far

- `vp check`
- `vp test`
- `vp check packages/vue-clamp/src/text.ts packages/vue-clamp/src/rich.ts packages/vue-clamp/src/LineClamp.ts packages/vue-clamp/src/RichLineClamp.ts packages/vue-clamp/src/InlineClamp.ts packages/vue-clamp/src/types.ts packages/vue-clamp/src/props.ts`
- `vp test packages/vue-clamp/tests/text.test.ts packages/vue-clamp/tests/exports.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/inline.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
- `vp run test:browser`
- `vp run build`
- Started the website with `vp dev --host 127.0.0.1 --port 5173` from `packages/website`; Vite
  selected `http://127.0.0.1:5175/` because 5173 and 5174 were already in use. Browser snapshots
  confirmed Boundary controls on the LineClamp, RichLineClamp, and InlineClamp demo surfaces.
