# Local prop destructuring scan

## Goals

- Scan the codebase for safe local destructuring opportunities like `const { items } = props` inside render or helper scopes.
- Use destructuring only where it reduces repeated dot access without harming Vue reactivity.
- Keep the simplification pass low-risk and behavior-preserving.

## Plan

1. Search for repeated `props.*` access patterns inside local scopes.
2. Apply the worthwhile local destructuring cleanup and similar syntax simplifications.
3. Re-run formatting and validation, then record the pass in journey notes.
