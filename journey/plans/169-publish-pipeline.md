# 169 Publish Pipeline

## Goal

Configure release automation for `vue-clamp` similar to `ecomfe/vue-echarts`:

1. CI keeps validating the package and also publishes preview builds for commits/PRs.
2. A dedicated tag-triggered release workflow validates, creates a GitHub release, and publishes
   `packages/vue-clamp` to npm with the correct dist-tag.

## Steps

1. Inspect the current repo workflows and the upstream `vue-echarts` release setup.
2. Add a release workflow adapted to this Vite+ workspace and single publishable package.
3. Add commit-preview publishing to CI using `pkg-pr-new`.
4. Update project memory and validate the workflow files locally.
