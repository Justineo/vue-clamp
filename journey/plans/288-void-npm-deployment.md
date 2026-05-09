# Void npm deployment

## Goal

Use the public `void@0.7.1` npm package for website deployment and remove the old private GitHub Packages access path.

## Plan

- Add `void@0.7.1` as the website deployment CLI dependency from the npm registry.
- Replace the Vite+ `vite` package alias with the public `vite@^8.0.11` package and remove the associated peer workaround.
- Replace CI deployment commands that use the old private scoped CLI with the installed `void` binary.
- Remove temporary GitHub Packages `.npmrc` setup and package-registry token usage from CI.
- Remove the local ignored root `.npmrc` registry override.
- Update `journey/design.md` so future sessions do not preserve the old private package assumptions.
- Run `vp install`, then validate with `vp check` and `vp test`.
