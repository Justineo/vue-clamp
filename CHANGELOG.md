# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0]

Minor release focused on one-line ellipsis placement.

### Added

- `<InlineClamp>` now supports `location`, using the same `start`, `middle`, `end`, and numeric
  ratio values as `<LineClamp>` to control how body text is kept around the ellipsis.

### Fixed

- `<InlineClamp>` now preserves meaningful spaces at split boundaries when the body is clamped.

## [1.1.0]

Minor release focused on richer multiline content.

### Added

- Added `<RichLineClamp>` for trusted inline HTML. It clamps from the end and preserves inline
  formatting, links, line breaks, inline media, and atomic inline content in rich text snippets.
- `<InlineClamp>` now supports the `ellipsis` prop, so one-line split text can use the same custom
  omission marker style as the multiline components.

### Changed

- `<InlineClamp>` now measures and rewrites only the body segment instead of relying on native
  `text-overflow`. The visible result is still single-line, but split `start` and `end` segments
  stay readable while the body can shrink all the way to the ellipsis.

### Fixed

- Fixed `<InlineClamp>` not restoring trimmed body text after its container grows wider.
- Fixed `<LineClamp>` edge cases where browser layout could undercount wrapped lines, so collapsed
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
- The old `Clamp` alias was removed. Use `<LineClamp>`.

### New in 1.0

- `<InlineClamp>` for one-line clamping with optional `split(text)`.
- `<WrapClamp>` for wrapped atomic items such as tags, chips, and selections.
- Built-in TypeScript types for props, slots, emits, and exposed methods.
- Numeric `location` ratios for `<LineClamp>`, in addition to `start`, `middle`, and `end`.

### Migration

- Read the full migration guide:
  [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
