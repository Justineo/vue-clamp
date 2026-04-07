# Plan

## Goal

Fix the local `vp run test:browser` hang at the actual boundary instead of keeping the package-local browser config workaround.

## Steps

1. Reproduce the hang with the smallest browser run and confirm whether it blocks before any real test logic executes.
2. Compare package-local and root browser config placement while keeping the new shared plain config fragments.
3. Restore the stable config ownership model, update package ownership for the Vue plugin, and verify the standard validation commands.
