# Inline Boundary Space Fix

Date: 2026-04-05

## Goal

Preserve visible spaces in `InlineClamp` when text is split across `start`, `body`, and `end` segments.

## Plan

1. Keep the public `start` / `body` / `end` segment structure unchanged.
2. Render leading and trailing plain-space runs inside each segment with preserved-space inline children.
3. Add a browser test that compares rendered width against a plain-text reference to catch missing boundary spaces.
4. Run focused browser tests for `InlineClamp`.
