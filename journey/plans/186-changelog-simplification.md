# Changelog simplification

## Goal

- Rewrite `CHANGELOG.md` in a simpler, user-facing style.
- Keep the release entry focused on what library users need to know.
- Use sentence case headings and preserve compatibility with the release-note extractor.

## Steps

1. Rewrite the `1.0.0` entry around breaking changes, new capabilities, and migration.
2. Remove implementation-detail language.
3. Verify `scripts/changelog-notes.mjs` still extracts the entry correctly.
