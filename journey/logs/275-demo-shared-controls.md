# Demo shared controls log

Date: 2026-04-30

## Decision

Move cross-example demo settings into one sticky surface-level control bar beneath the component
tabs. Keep source editors directly above that sticky bar when they are large enough to need their
own row.

## Implementation

- `LineClamp` now shares text source, boundary, width, CSS hyphens, and RTL across its examples.
- `RichLineClamp` now shares trusted HTML source, boundary, width, and CSS hyphens across its
  examples.
- `InlineClamp` already had one shared location/boundary/ratio/width surface and now participates
  in the same sticky shared-controls structure.
- `WrapClamp` now shares width and RTL across the tabs and invitees examples.
- Demo browser tests assert that every surface has sticky shared controls below the component tabs
  and that the shared controls affect the relevant examples.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build`
- Manual Playwright check on `http://127.0.0.1:5175/` confirmed sticky shared controls for line,
  rich, inline, and wrap surfaces.
