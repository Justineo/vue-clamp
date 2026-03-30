# Workspace Layout Cleanup

## Goal

Move the demo site from `apps/website` to `packages/website` and remove the unused `packages/utils` scaffold.

## Scope

- workspace directory layout
- `pnpm-workspace.yaml`
- root `tsconfig.json`
- root docs and current design snapshot
- lockfile/workspace install state
- `journey/logs/029-workspace-layout-cleanup.md`

## Plan

1. Move `apps/website` to `packages/website`.
2. Remove `packages/utils`.
3. Update workspace/config/docs that still refer to the old layout.
4. Refresh install state and validate with `vp check`, `vp test`, and `vp run build -r`.
