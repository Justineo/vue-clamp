# 001 Vue 3 Rebuild

Date: 2026-03-29
Status: In progress

## Objective

Rebuild `vue-clamp` as a Vue 3-only package on top of `@chenglou/pretext`, preserve the `0.4.1` component API, replace scaffold examples, add a meaningful demo site, and set up CI plus Renovate.

## Source of Truth

- Legacy baseline: `master` branch `0.4.1`
- Research: `journey/research/001-pretext-integration.md`
- Design snapshot: `journey/design.md`

## Work Breakdown

### 1. Project memory and repo baseline

- [x] Inspect the scaffolded workspace structure.
- [x] Install workspace dependencies with `vp install`.
- [x] Extract the legacy API and behavior from `master`.
- [x] Read the Pretext integration research.
- [x] Create the canonical design snapshot in `journey/design.md`.
- [x] Create this implementation plan.
- [x] Record progress and decisions in `journey/logs/001-vue3-rebuild.md`.

### 2. Workspace restructuring

- [x] Replace `packages/utils` with `packages/vue-clamp`.
- [x] Rename and normalize package metadata for a publishable library.
- [x] Update the workspace root metadata and scripts for the new package layout.
- [x] Remove scaffold-only example code and assets from `apps/website`.

### 3. Library API and implementation

- [x] Define the public Vue 3 prop, slot, emit, and instance typings.
- [x] Implement plain-text slot extraction and normalization.
- [x] Build the low-level Pretext layout adapter:
  - [x] prepared-text caching
  - [x] line iteration helpers
  - [x] effective max-line calculation from `maxLines` and `maxHeight`
  - [x] end-clamp logic
  - [x] start-clamp logic
  - [x] middle-clamp logic
- [x] Build DOM measurement helpers:
  - [x] container width
  - [x] computed font shorthand
  - [x] computed line height
  - [x] `before` width
  - [x] `after` width
  - [x] autoresize observation
- [x] Implement bounded multi-pass convergence for `after` content that depends on clamp state.
- [x] Implement expanded and collapsed state handling plus `update:expanded`.
- [x] Implement `clampchange`.
- [x] Expose imperative `expand`, `collapse`, and `toggle`.
- [x] Preserve SSR-safe rendering behavior.

### 4. Tests

- [x] Add unit tests for low-level clamp calculations.
- [x] Add component tests for the Vue contract that is stable in jsdom:
  - [x] unclamped rendering fallback
  - [x] `expanded` and `update:expanded`
  - [x] `before` slot
  - [x] `after` slot
- [x] Add algorithm coverage for:
  - [x] `maxLines`
  - [x] `maxHeight`
  - [x] `location="start"`
  - [x] `location="middle"`
  - [x] `location="end"`
- [x] Add at least one regression test covering the `0.4.1` `location="start"` bugfix.

Notes:

- Full browser-faithful component clamp assertions are intentionally not covered in jsdom because the real implementation depends on live font and layout measurement. That gap is acceptable for now because the clamp engine itself is covered directly.

### 5. Demo site

- [x] Build a Vue 3 website under `apps/website`.
- [x] Reintroduce the legacy demo content in a modernized layout:
  - [x] overview and feature summary
  - [x] installation and usage
  - [x] interactive examples
  - [x] API reference
- [x] Showcase improved demos for slot-driven toggles and ellipsis locations.
- [x] Ensure the site works on desktop and mobile.

### 6. CI and dependency automation

- [x] Add GitHub Actions workflows for install, check, test, and build.
- [x] Use Vite+ setup best practices in CI.
- [x] Add Renovate config:
  - [x] weekly schedule
  - [x] minor and patch grouped together
  - [x] majors separated
  - [x] avoid updates newer than 7 days

### 7. Validation and documentation

- [x] Run `vp check`.
- [x] Run `vp test`.
- [x] Run the website build and library pack.
- [x] Update `journey/design.md` if implementation decisions changed.
- [x] Record final implementation notes and open risks in the log.

## Execution Notes

- Keep edits compatible with the existing dirty worktree and do not restore the deleted Vue 2 scaffold files.
- Favor render-function and TypeScript-first component internals unless Vue SFC tooling becomes clearly necessary.
- Preserve the legacy surface API even where Vue 3 usage syntax differs.
