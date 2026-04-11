# General naming guideline pass

## Goals

- Apply the naming guideline broadly, not just to destructuring.
- Remove redundant prefixes when file, function, or local scope already provides the meaning.
- Keep names precise; avoid replacing long names with vague ones.

## Plan

1. Inspect the recently touched runtime and website files for names that restate surrounding context.
2. Rename the worthwhile cases and keep behavior unchanged.
3. Re-run formatting and validation, then record the pass.
