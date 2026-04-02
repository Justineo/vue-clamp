# Custom Website Shiki Theme

## Visual Thesis

Use a restrained light syntax theme that feels native to the website: ink neutrals, one violet accent family, and muted support hues for strings and types instead of the greener Vitesse palette.

## Content Plan

1. Add one website-local Shiki theme definition.
2. Replace the current bundled theme usage in the website highlighter setup.
3. Keep the existing code block container styling unchanged so only token color harmony changes.

## Interaction Thesis

1. Keep code samples visually quieter than the interactive demos.
2. Preserve strong contrast for scanability.
3. Avoid introducing a dark-mode or multi-theme toggle to solve a simple palette mismatch.

## Implementation Plan

1. Inspect the installed Shiki theme shape and use a typed local `ThemeRegistration`.
2. Create `packages/website/src/shiki-theme.ts` with a minimal light theme that matches the site palette.
3. Update `packages/website/src/App.vue` to register and use the custom theme for all highlighted code samples.
4. Run `vp check --fix` and `vp run test:browser`.
