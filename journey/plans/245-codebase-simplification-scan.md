# Codebase simplification scan

## Goals

- Scan the current codebase for additional simplification opportunities beyond the recent multiline refactor.
- Prefer simpler names, narrower internal contracts, less duplication, and lighter syntax where it improves readability.
- Keep behavior, performance, and correctness unchanged.

## Plan

1. Inspect the main runtime and supporting source files for concrete simplification opportunities.
2. Implement the worthwhile changes, keeping abstractions narrow and explicit.
3. Re-run formatting and validation, then record the resulting simplification pass.
