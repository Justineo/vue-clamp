# WrapClamp stress-table demo

## Goal

Add a realistic `WrapClamp` stress-test demo to the docs site: a table with 100 rows and a wrapped-label column so we can evaluate repeated clamps inside a document-style surface.

## Direction

- Keep the demo aligned with the existing `WrapClamp` demo system.
- Use a scroll-contained table so the page stays readable.
- Use an auto-layout table and a width control for the clamped labels column.
- Render one `WrapClamp` instance per row in the labels column with a compact `+N` summary in `after`.
- Add a small browser regression that verifies the new demo exists and actually renders 100 rows.

## Validation

- `vp check`
- `vp test`
- `vp test -c vite.browser.config.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
