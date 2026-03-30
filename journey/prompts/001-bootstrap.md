This is the scaffolded structure for a new version of the `Justineo/vue-clamp` project. You need to remove the example code under `apps/website` and `packages`.

The previous version is based on Vue 2 and is on the `master` branch. I want you to build a new version that only supports Vue 3, using the latest Vue 3 syntax and precise TypeScript typings.

Requirements:

1. Replicate the API of version `0.4.1`
2. Implement it based on the low-level API of the recently released `@chenglou/pretext` package (https://github.com/chenglou/pretext). See the research report at `journey/research/001-pretext-integration`
3. Break down the overall engineering plan and list all actionable steps in detail in a plan. Use it as the source of truth to track progress.
4. Set up CI following best practices, and configure Renovate to update dependencies weekly. Dependencies released more than 7 days ago should be updated, with minor and patch updates grouped together, while major updates should be opened as separate PRs.
5. Implement a demo site in `apps/website`. You can refer to the old version in the `master` branch for content, but it does not need to be identical and can include meaningful improvements.
