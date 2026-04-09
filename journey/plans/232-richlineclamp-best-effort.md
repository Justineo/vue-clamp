# RichLineClamp best-effort rich-content plan

## Goal

- Relax the rich-content support contract so `RichLineClamp` tries to clamp arbitrary user-provided
  markup instead of rejecting broad classes of elements up front.

## Approach

1. Update `rich.ts` so rich-node preparation is behavior-first:
   - stop rejecting a broad hard-coded tag set during parse
   - treat leaf elements without light DOM content as atomic instead of immediate fallback
   - keep runtime layout validation as the main guardrail
2. Keep only the layout checks that are required to avoid obviously unstable clamp results
   (positioned or floated descendants, non-inline wrappers/atomics).
3. Update docs/tests to reflect the new best-effort semantics and remove tests that depend on the
   older strict fallback contract.
4. Run focused validation with Vite+ commands.
