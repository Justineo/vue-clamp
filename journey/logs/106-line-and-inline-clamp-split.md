2026-04-02

- Renamed the multiline component surface to `LineClamp` and kept `Clamp` as a compatibility alias.
- Added `InlineClamp` as a native single-line component with optional `split(text) => { start?, body, end? }`.
- Added the `vue-clamp/inline` build entry and re-exported inline-related types from that entry.
- Updated package docs, tests, website imports, and design memory for the two-surface package model.
- Validation passed with `vp check`, `vp test`, `vp run test:browser`, and `vp run build -r`.
