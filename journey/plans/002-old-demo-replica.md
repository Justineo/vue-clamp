# Old Demo Replica

Date: 2026-03-29

## Goal

Replicate the legacy `master` demo design inside `apps/website` while keeping the rebuilt Vue 3 package and current TypeScript setup intact.

## Constraints

- Preserve the new Vue 3-only implementation and package API.
- Match the old demo's visual structure, controls, bilingual toggle, and Spectre-based presentation as closely as practical.
- Adapt Vue 2-specific usage patterns to Vue 3 equivalents where needed, especially `.sync` to `v-model:expanded`.
- Keep the site buildable inside the current Vite+ workspace.

## Actionable Steps

- [completed] Capture the old demo's structure, text sections, controls, and styling from `master`.
- [completed] Add the website dependencies needed to recreate the legacy demo presentation and code highlighting.
- [completed] Rebuild `apps/website/src/App.vue` to mirror the old demo layout, including:
  - bilingual toggle
  - features, demo, usage, API, and footer sections
  - four demo cases and their interactive controls
  - Vue 3-compatible usage and API wording where the old site was Vue 2-specific
- [completed] Restore the legacy visual language in `apps/website/src/style.css` with Spectre imports and equivalent custom CSS.
- [completed] Add any helper code required for code highlighting in the website app.
- [completed] Validate the repo with `vp check`, `vp test`, and `vp run build -r`.
- [completed] Update `journey/logs/002-old-demo-replica.md` with implementation notes and mark this plan complete.
