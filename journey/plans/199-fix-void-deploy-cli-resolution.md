# Fix Void deploy CLI resolution

## Goal

Make the `Deploy Website` GitHub Actions workflow reliably deploy the website to Void on `main`.

## Observed failure

- The latest deploy run installs dependencies successfully, then fails on `vp exec --filter website -- void deploy`.
- Local inspection shows `void` is available at `packages/website/node_modules/.bin/void`, not at the repo root.
- The workflow also lets `voidzero-dev/setup-vp` run its default `vp install` before the temporary GitHub Packages auth file is written.

## Plan

1. Disable `setup-vp`'s implicit install in the deploy workflow.
2. Keep the explicit post-auth `vp install --frozen-lockfile` step.
3. Invoke the workspace-local Void CLI directly from `packages/website`.
4. Update `journey/design.md` and add a matching log entry.
5. Verify the command path locally, then commit and push only the deploy fix.
