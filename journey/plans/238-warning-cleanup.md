# Warning cleanup

## Goals

- Remove the local git housekeeping warning about unreachable loose objects.
- Determine whether the `vitest` / `@vitest/browser` mixed-version warning can be fixed in this
  repo or only through an upstream `vite-plus` update.

## Plan

1. Inspect the current git housekeeping state and clean it up safely.
2. Inspect the installed Vitest-related packages and the warning source.
3. Apply the narrowest repo-level fix if one exists; otherwise document the warning as an upstream
   toolchain issue and confirm the repo is otherwise clean.
