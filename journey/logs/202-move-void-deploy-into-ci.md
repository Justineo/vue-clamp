# 202 Move Void deploy into CI

## 2026-04-07

- Investigated a deploy failure where `void deploy` rebuilt the website in a fresh workflow runner
  and failed to resolve the workspace `vue-clamp` package during `vue-tsc`.
- Confirmed the installed `void@0.2.2` CLI supports `void deploy --skip-build`.
- Moved the website deploy path into `.github/workflows/ci.yml` so it runs only for `push` to
  `main`, after `vp run build -r` has already built the monorepo successfully.
- Kept the runner-side `vp exec void staging off` step before deploy.
- Removed the standalone `.github/workflows/deploy.yml` workflow because it is no longer needed.
