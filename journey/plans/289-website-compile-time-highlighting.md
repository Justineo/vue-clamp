# Website compile-time highlighting

## Goal

Remove Shiki from the website browser runtime. The website has only static code snippets and a finite
set of installation commands, so syntax highlighting can be generated during the Vite build.

## Plan

1. Move the Shiki highlighter behind a build-only helper used by Vite.
2. Add a Vite plugin that transforms imports with a highlight query into pre-rendered HTML modules.
3. Replace the runtime `import("./highlight")` path in `App.vue` with static highlighted HTML imports.
4. Keep raw snippet imports for copy behavior and source display fallback.
5. Validate that the production build no longer emits a large highlight chunk, then run the standard
   project checks.

## Notes

- Installation command highlighting needs static variants for `vp`, `npm`, `pnpm`, `yarn`, and `bun`.
- The `agent` installation copy is plain text and should keep using the fallback code block path.
