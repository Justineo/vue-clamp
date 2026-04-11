# Redundant prefix scan

## Goals

- Apply the naming guideline to avoid redundant prefixes when the surrounding context already gives the meaning.
- Focus on recently touched runtime and website files.
- Rename only the cases that get clearer, not merely shorter.

## Plan

1. Inspect the current code for names that repeat file or local-scope context unnecessarily.
2. Rename the worthwhile cases and keep contracts/functionality unchanged.
3. Re-run formatting and validation, then record the cleanup.
