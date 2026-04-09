# Plan

## Goal

Add stable hash ids for the website component tabs and keep the active component surface synced with
the URL hash.

## Steps

1. Introduce an explicit `surface <-> hash` mapping in the website app and sync the active surface
   from recognized hashes on mount and browser navigation.
2. Update `ComponentTabs` so each surface tab has a stable DOM `id`, then write the hash on user
   tab changes without disturbing unrelated section hashes.
3. Add browser coverage for direct-link and click-to-hash behavior, then update journey memory and
   validate.
