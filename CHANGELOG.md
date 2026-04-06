# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1]

Patch release focused on multiline clamp correctness.

### Fixed

- Fixed `LineClamp` edge cases where browser layout could undercount wrapped lines, so collapsed
  text now respects `maxLines` and `maxHeight` more reliably.

## [1.0.0]

First stable release of `vue-clamp` for Vue 3.

### Breaking changes

- Vue 3 is now required. The `0.x` line targeted Vue 2.
- The package no longer has a default export. Import named exports such as `LineClamp`,
  `InlineClamp`, or `WrapClamp`.
- The multiline component now takes its source text from the `text` prop. The default slot is no
  longer the clamped text source.
- The root tag prop was renamed from `tag` to `as`.
- `autoresize` was removed.
- Expansion now uses Vue 3 `v-model:expanded` instead of the Vue 2 `.sync` pattern.
- If you style component internals, switch to the documented `data-part` hooks.
- The old `Clamp` alias was removed. Use `LineClamp`.

### New in 1.0

- `InlineClamp` for one-line clamping with optional `split(text)`.
- `WrapClamp` for wrapped atomic items such as tags, chips, and selections.
- Built-in TypeScript types for props, slots, emits, and exposed methods.
- Numeric `location` ratios for `LineClamp`, in addition to `start`, `middle`, and `end`.

### Migration

- Read the full migration guide:
  [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
