# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0]

The `1.0.0` release is the first stable Vue 3 release of `vue-clamp`. It keeps the core multiline
clamp idea from `0.x`, but the implementation and public package surface were rebuilt around Vue 3,
TypeScript, and browser-aligned DOM measurement.

### Breaking Changes

- Vue 3 is now required. The `0.x` line targeted Vue 2.
- The package no longer has a default export. Import named exports such as `LineClamp` or `Clamp`.
- `LineClamp` now takes its source text from the `text` prop. The default slot is no longer the
  clamped text source.
- The root tag prop was renamed from `tag` to `as`.
- `autoresize` was removed. Clamp components now observe relevant layout changes automatically.
- Expansion binding now uses Vue 3 `v-model:expanded` / `update:expanded` instead of the Vue 2
  `.sync` pattern.
- Internal DOM structure changed. Only documented `data-part` styling hooks are stable.

### Added

- `InlineClamp` for native one-line truncation with optional `split(text)`.
- `WrapClamp` for wrapped atomic items such as badges, pills, and tags.
- Full TypeScript types for props, slots, emits, and exposed instance methods.
- Numeric `location` ratios for `LineClamp` in addition to `start`, `middle`, and `end`.
- Improved accessibility for rewritten multiline text through a hidden full-text mirror node.

### Changed

- `Clamp` remains available as a compatibility alias for `LineClamp`.
- `before` and `after` slots still expose `expand`, `collapse`, `toggle`, `clamped`, and
  `expanded`, but now live on a Vue 3-only runtime.
- `WrapClamp` `before` / `after` slots expose `hiddenItems` for hidden item access.

### Migration

- Read the full migration guide:
  [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
