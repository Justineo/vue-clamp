# Move Void deploy into CI

## Goal

Deploy the website from the main `CI` workflow instead of a separate `workflow_run` deploy workflow.

## Reason

- The separate deploy workflow runs in a fresh checkout and invokes `void deploy`, which rebuilds the
  website in isolation.
- The website build depends on the workspace package build output for `vue-clamp`, so the fresh-job
  rebuild fails even though the monorepo build already passed in `CI`.
- The Void CLI supports `void deploy --skip-build`, so the most direct fix is to deploy from the
  same validated `CI` job after `vp run build -r`.

## Plan

1. Add main-only deploy steps to `.github/workflows/ci.yml` after the build.
2. Keep the runner-side `void staging off` step before deploy.
3. Use `vp exec void deploy --skip-build` from `packages/website`.
4. Remove the standalone `.github/workflows/deploy.yml`.
5. Update journey memory and push the workflow change.
