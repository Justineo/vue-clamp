# Void npm deployment

- Verified `void@0.7.1` is available on the public npm registry and exposes the `void` binary.
- Installed `void@0.7.1` as a website dev dependency through the workspace catalog.
- Replaced the Vite+ `vite` package alias with public npm `vite@8.0.11` and removed the peer workaround.
- Changed the website Vite config to export a plain object so Vue plugin types no longer have to pass through Vite+ `defineConfig` after the direct Vite switch.
- Replaced CI's private scoped `vp dlx` deployment with `vp exec void deploy --skip-build --project vue-clamp`.
- Removed the deploy-time GitHub Packages `.npmrc` setup and package-registry token usage from CI.
- Removed the ignored local root `.npmrc` that pointed the old private scope at GitHub Packages.
- Validation: `vp check`, `vp test`, `vp run build`, and `vp run test:browser` pass. Browser tests still emit ResizeObserver loop console noise but exit successfully.
