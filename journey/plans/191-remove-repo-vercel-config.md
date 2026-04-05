# 191 Remove repo Vercel config

## Goal

Keep Vercel deployment settings in the Vercel project dashboard and remove the redundant
repo-side `vercel.json`.

## Steps

1. Remove `vercel.json`.
2. Update project memory to reflect dashboard-managed Vercel settings.
3. Validate the website still builds cleanly.
