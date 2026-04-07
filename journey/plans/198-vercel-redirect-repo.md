# 198 Vercel redirect repo

## Goal

Preserve the old `vue-clamp.vercel.app` hostname by moving it to a dedicated redirect-only Vercel project that permanently redirects to `https://vue-clamp.void.app`.

## Constraints

- Avoid reintroducing long-term Vercel config into the main `vue-clamp` repo.
- Keep the redirect repo minimal and private.
- Publish the new repo under the authenticated GitHub owner and push an initial `main` branch.

## Steps

1. Create a minimal redirect-only repo at `~/Developer/Justineo/vue-clamp-redirect`.
2. Add a `vercel.json` catch-all permanent redirect to `https://vue-clamp.void.app/:path*`.
3. Initialize git, commit the initial contents, create a private GitHub repo, and push `main`.
