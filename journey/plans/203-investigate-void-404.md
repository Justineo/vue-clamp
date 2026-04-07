# Investigate Void production 404

## Goal

Restore `https://vue-clamp.void.app/` after the new CI-driven Void deploy path started returning a platform 404.

## Working hypothesis

- The CI deploy step succeeds, but it likely uploads the wrong artifact root.
- `packages/website` builds both a top-level `dist/` tree and a static client output under `dist/client/`.
- Void static deploy inference appears to default to `dist/` when no explicit output directory is configured.
- If the platform expects the static entrypoint under `dist/client/`, deploying `dist/` can produce a successful upload followed by a 404 at runtime.

## Plan

1. Confirm the current live symptom and latest successful deploy details.
2. Inspect the built website output shape plus the Void CLI/config docs to confirm the correct deploy directory.
3. Update CI and/or repo config so Void deploys the website from the intended static output directory.
4. Verify locally, push to `main`, and confirm the live hostname serves content again.
