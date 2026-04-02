# 087 As And Text API

## Goal

Adopt a simpler public API for the single Vue Clamp component by renaming `tag` to `as` and replacing the plain-text default slot with a `text` prop.

## Steps

1. Update the component and public types.
   - Rename `tag` to `as`.
   - Replace render-time default-slot text extraction with a `text` prop.
   - Remove any runtime logic that only existed to support plain-text slot extraction.
2. Update package consumers.
   - Adjust tests, README, and demo site to use `text` and `as`.
   - Keep `before` and `after` slots unchanged.
3. Validate and update memory.
   - `vp check`
   - `vp test`
   - `vp run test:browser`
   - `vp run build -r`

## Outcome

- The component surface is now prop-driven for clamped content: `text` replaces the old plain-text default slot.
- The root tag prop is now `as`.
- The runtime is simpler because it no longer has to collect text from rendered VNodes and synchronize it after updates.
