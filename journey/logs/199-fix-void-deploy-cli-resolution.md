# 199 Fix Void deploy CLI resolution

## 2026-04-07

- Inspected the latest `Deploy Website` GitHub Actions run (`24064432033`) with `gh run view`.
- Confirmed the failing step was command lookup, not checkout or Void auth:
  - `vp exec --filter website -- void deploy`
  - `Command 'void' not found in node_modules/.bin`
- Verified locally that the Void CLI is installed at `packages/website/node_modules/.bin/void`.
- Updated `.github/workflows/deploy.yml` to:
  - move the temporary GitHub Packages `.npmrc` setup before `voidzero-dev/setup-vp`
  - expose `NODE_AUTH_TOKEN` at the job level so `setup-vp` can run its built-in install
  - deploy from `packages/website` via `vp exec void deploy`
- Verified locally:
  - `.github/workflows/deploy.yml` parses as YAML
  - `packages/website: vp exec void auth whoami` resolves and runs
