# Plan

## Goal

Add a `bumpp`-based release flow for the `vue-clamp` package so version bumps stop being a manual
edit and stay aligned with the existing tag-driven GitHub publish workflow.

## Steps

1. Inspect the current release workflow and the `vue-echarts` reference pattern.
2. Add `bumpp` to the workspace and wire a root `release` script around
   `packages/vue-clamp/package.json`.
3. Document the intended release flow in project memory and verify the local command shape.
