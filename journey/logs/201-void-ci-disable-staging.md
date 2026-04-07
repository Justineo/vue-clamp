# 201 Disable Void staging mode in CI

## 2026-04-07

- Investigated a failed `Deploy Website` run that reached the deploy step and printed the
  `⚠ STAGING MODE` banner before rejecting `VOID_TOKEN`.
- Inspected the installed `void@0.2.2` CLI implementation and confirmed:
  - staging mode defaults to on unless `~/.void/config.json` contains `"staging": false`
  - `void staging off` writes that setting
- Updated `.github/workflows/deploy.yml` to run `vp exec void staging off` in
  `packages/website` after `setup-vp` and before `vp exec void deploy`.
