# Remove Autoresize And Inline Entry

## Goal

Simplify the public API by removing `LineClamp.autoresize` and the extra `vue-clamp/inline` package entry.

## Plan

1. Remove `autoresize` from `LineClamp` props, types, docs, and tests, and always observe the root element for size changes.
2. Remove the dedicated `vue-clamp/inline` package entry and related docs/test references while keeping `InlineClamp` exported from the root package.
3. Move the `InlineClamp is native-only and single-line-only...` guidance into the docs-site notes section.
4. Update project memory and validate with `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
