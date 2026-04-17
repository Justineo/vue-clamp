# 264 Rich patch tail clone fix

## 2026-04-16

- Confirmed the prior benchmark was incomplete: `replaceChildren` went to zero, but
  `clonePrefix()` still cloned unchanged source prefixes and could create fresh `<img>` nodes.
- Changed rich structural patching to clone only the suffix under the shared patch anchor.
- Changed hidden-probe image materialization to preserve image attributes but replace
  `src` / `srcset` / `sizes` with an inert data URI so probe reclamps do not fetch remote images.
- Added rich benchmark counters for total `cloneNode` calls and `<img>` clone calls.
- Latest rich benchmark after the fix:
  - `fit-width-sweep`: `medianImageCloneCalls: 0`, `medianCloneNodeCalls: 0`, `medianTotalMs: 0.20ms`
  - `truncate-width-sweep`: `medianImageCloneCalls: 0`, `medianCloneNodeCalls: 34`, `medianTotalMs: 1.50ms`
  - `dense-grid-width-sweep`: `medianImageCloneCalls: 0`, `medianCloneNodeCalls: 40`, `medianTotalMs: 44.10ms`
- Validation passed:
  - `vp check`
  - `vp test`
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  - `vp run benchmark:rich`
- Demo verification with Chromium cache disabled on the rich max-lines width slider:
  - initial `/rich-demo-icon.svg` requests: `1`
  - requests during width drag: `0`
  - hidden probe image source: inert data URI
  - visible image source: `/rich-demo-icon.svg`
