# RichLineClamp review plan

## Scope

- Review the current `feat/rich-text` worktree against `main`.
- Focus on the new `RichLineClamp` surface and the supporting refactors in shared clamp logic,
  exports, types, docs, demos, and browser tests.

## Review steps

1. Inspect the branch diff to identify the implementation and test surface.
2. Read the runtime files for `RichLineClamp`, `rich.ts`, `layout.ts`, and touched shared helpers.
3. Read the browser tests and website demo changes that exercise the new behavior.
4. Validate key invariants against the documented design in `journey/design.md`.
5. Report review findings ordered by severity, with file and line references, plus residual risks.
