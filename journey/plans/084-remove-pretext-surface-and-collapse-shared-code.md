# 084 Remove Pretext Surface And Collapse Shared Code

## Goal

Remove the Pretext implementation from the package and use that removal to delete shared helpers, tests, and benchmark code that only existed for the `fast` path.

## Steps

1. Remove the public Pretext surface. Completed.
   - Deleted `src/fast.ts` and the `vue-clamp/fast` export.
   - Removed Pretext-specific package metadata and dependency wiring.
2. Delete Pretext-only internals and tests. Completed.
   - Removed `src/clamp.ts`, `src/dom-clamp.ts`, the Pretext benchmark adapter, and the fast/engine tests.
   - Rewrote browser helpers that used Pretext internals.
3. Collapse shared modules and benchmark/UI code. Completed.
   - Reduced shared DOM helpers to the pieces still used by the default and legacy entries.
   - Reduced benchmark/report/UI/test code from three engines to default + legacy only.
   - Flattened the legacy component to the same simpler text-sync shape as the default component.
4. Validate and update journey memory. Completed.
   - `vp install`
   - `vp check`
   - `vp test`
   - `vp run test:browser`
   - `vp run build -r`
