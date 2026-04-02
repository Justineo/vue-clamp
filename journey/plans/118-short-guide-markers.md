# Short Guide Markers

## Goals

- Keep the width and max-height guide borders in the website demos.
- Replace the full-length edge treatment with shorter markers.
- Remove the remaining decorative hatch styling.

## Changes

1. Drop the inset box-shadow guide borders on `demo-clamp`.
2. Render the width edge and max-height edge as shorter pseudo-element markers.
3. Keep the cues subtle and aligned to the existing demo layout.

## Validation

- `vp check --fix`
- `vp run test:browser`
