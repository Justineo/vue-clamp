# Plan

## Goal

Implement inline rich text support for `LineClamp` based on `journey/research/211-rich-text.md`,
covering the core runtime, tests, docs, and demos without widening the component into a generic
VNode truncator.

## Steps

1. Refactor `LineClamp` into a shared shell that can clamp either plain `text` or sanitized inline
   `html`, while preserving the existing expand/collapse, slot, and measurement contract.
2. Add a rich-text preparation and materialization path that supports the scoped inline subset,
   atomic `img` and outer `svg`, `br` / `wbr`, end truncation only, and safe full-render fallback
   when content is unsupported or not measurable.
3. Extend browser coverage for the new `html` mode, including fallback behavior, location warnings,
   atomic content, and image-driven reclamping, then run the standard workspace validation commands.
4. Update the package docs, changelog, website API reference, and live demos so the new source mode,
   its constraints, and its trust model are documented coherently.
