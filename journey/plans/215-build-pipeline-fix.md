# Build Pipeline Fix

## Goal

Make the local, CI, and release build commands actually build the package and website before
publishing or deploying.

## Context

- `vp run build -r` currently exits successfully with `0 tasks`.
- The root `build` script uses that command, and both CI and release workflows call the same
  command.
- Main CI fails on the Void deploy step because `packages/website/dist` was never produced before
  `void deploy --skip-build`.

## Plan

1. Replace the root build script with a Vite+ filtered build over the `website...` dependency
   chain.
2. Make `ready`, CI, and release use the corrected root build command.
3. Verify with `vp run build`, `vp run ready`, `vp pm audit`, and publish dry-run.
4. Record the final repo-standard decision in `journey/design.md`.
