# 061 Latest Inline Toggle Underfill Check

## Goal

Verify whether the current website build still underfills the first "Max lines with inline toggle" demo at `373px`, and fix the remaining root cause if the latest code still clamps too aggressively.

## Plan

1. Compare the real website output on the built site against the component-level expectation at `373px`.
2. If the built site still underfills, instrument the real page to determine whether the issue is stale bundling, website integration, or a remaining library correction bug.
3. Implement the narrowest fix that makes the real page match the maximum browser-fit text closely.
4. Add or tighten a browser regression on the actual demo path so this exact underfill cannot regress silently.
5. Re-run `vp check`, `vp test`, `vp run test:browser`, and a website build.
