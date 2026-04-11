# Broader destructuring scan

## Goals

- Scan the codebase for repeated object access patterns beyond `props`.
- Apply local destructuring and similar cleanup only where it makes the code clearer.
- Keep the resulting code explicit and low-risk.

## Plan

1. Search the runtime and website source for repeated access on the same local objects.
2. Apply the worthwhile cleanup without changing behavior or weakening reactivity.
3. Re-run formatting and validation, then record the pass in journey notes.
