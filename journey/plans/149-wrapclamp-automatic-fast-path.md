# WrapClamp automatic fast path

## Goal

Replace the explicit `WrapClamp` strategy variants with one automatic engine split:

- use pure calculation for the best case (`maxLines === 1` and `maxHeight == null`)
- fall back to DOM-render-and-search for everything else
- update the website demo to call out when the fallback path is active

## Direction

- Remove the public `strategy` prop and the internal cache/defer strategy branches.
- Keep `WrapClamp` item-driven and browser-aligned overall, but make the one-line path calculation-first.
- For the one-line path:
  - measure exact item widths from rendered item shells
  - measure exact `before` width
  - measure exact `after` width for relevant hidden counts
  - compute the largest visible prefix numerically and commit directly
  - verify the result against the current DOM once; fall back to the DOM search path if it disagrees
- For non-eligible cases (`maxLines !== 1` or `maxHeight != null`), continue using the current DOM-driven search.
- Remove obsolete cache benchmark/tests and strategy-switch demo UI.
- Add website messaging that the one-line path is the fast path and other configurations may incur more layout work.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
