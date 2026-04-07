# 197 Void main deploy workflow

## Goal

Deploy the website package to the linked Void project automatically for successful `main` commits.

## Constraints

- Follow Void's documented CI contract: GitHub Actions plus `VOID_TOKEN` auth.
- Use the repo's Vite+ workflow instead of invoking `pnpm` directly.
- Avoid depending on the untracked local `packages/website/.void/project.json` link state in CI.

## Steps

1. Read the local Void deployment and CLI docs to confirm the supported GitHub Actions flow.
2. Add a dedicated deploy workflow that runs after the existing `CI` workflow succeeds on `main`.
3. Run the deploy step from `packages/website` with `vp exec void deploy` and an explicit `VOID_PROJECT`.
4. Update shared project memory with the new deployment automation and record the implementation log.
