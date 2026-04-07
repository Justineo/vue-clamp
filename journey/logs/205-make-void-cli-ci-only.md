# 2026-04-07 Make Void CLI CI-only

- Confirmed the website no longer needs `void` for runtime or build integration.
- Removed `void` from `packages/website/package.json` and from the workspace catalog in `pnpm-workspace.yaml`.
- Ran `vp install` to regenerate `pnpm-lock.yaml`; the lockfile no longer contains `@void-sdk/void`.
- Updated `packages/website/void.json` to keep only the deploy inference fields and removed the local `$schema` path, since `void` is no longer installed in normal workspace `node_modules`.
- Changed `CI` deployment steps to:
  - keep normal `setup-vp` installs public-only
  - write the GitHub Packages `.npmrc` only for the `main` deploy path
  - run `vp dlx @void-sdk/void@0.2.2 staging off`
  - run `vp dlx @void-sdk/void@0.2.2 deploy --skip-build`
- Removed the now-unnecessary GitHub Packages auth setup from `release.yml`.
- Verification:
  - `vp install`
  - `vp run build -r`
  - `vp check` (same two pre-existing unused-helper warnings)
  - `vp dlx @void-sdk/void@0.2.2 auth whoami`
  - `cd packages/website && vp dlx @void-sdk/void@0.2.2 project status`
