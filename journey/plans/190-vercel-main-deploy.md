# Vercel main deployment

## Goal

- Align the Vercel project with the current `main`-based repo and deploy the website successfully.

## Known issues

- The existing Vercel project still reflects the old `master`-based setup.
- The latest production deployment failed because Vercel used `pnpm@9` instead of the pinned
  `pnpm@10.33.0`, which caused a frozen-lockfile config mismatch.
- There is no repo-side `vercel.json` or local `.vercel/project.json` linkage in the workspace.

## Steps

1. Inspect the current Vercel project and local linkage state.
2. Add the minimal repo-side Vercel config for the current workspace/build flow.
3. Deploy from the current `main` branch and verify the resulting deployment.
