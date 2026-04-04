# Release v1.0.0

## Goal

- Cut the `v1.0.0` release from `main` using the repo's `bumpp`-based release flow.

## Preconditions

- `main` is checked out.
- The worktree is clean.
- `CHANGELOG.md` already contains a `1.0.0` entry.
- The package version in `packages/vue-clamp/package.json` is still `0.5.0`.

## Steps

1. Run the minimal release preflight for the configured toolchain.
2. Execute `vp run release -- --release 1.0.0`.
3. Verify the resulting commit/tag state locally and report any follow-up needed from GitHub Actions.
