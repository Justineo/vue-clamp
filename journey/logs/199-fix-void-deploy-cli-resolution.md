# 199 Fix Void deploy CLI resolution

## 2026-04-07

- Inspected the latest `Deploy Website` GitHub Actions run (`24064432033`) with `gh run view`.
- Confirmed the failing step was command lookup, not checkout or Void auth:
  - `vp exec --filter website -- void deploy`
  - `Command 'void' not found in node_modules/.bin`
- Verified locally that the Void CLI is installed at `packages/website/node_modules/.bin/void`.
- Updated `.github/workflows/deploy.yml` to:
  - set `run-install: false` on `voidzero-dev/setup-vp`
  - keep the explicit authenticated `vp install --frozen-lockfile`
  - deploy from `packages/website` via `./node_modules/.bin/void deploy`
- Verified locally:
  - `.github/workflows/deploy.yml` parses as YAML
  - `packages/website/./node_modules/.bin/void auth whoami` resolves and runs
