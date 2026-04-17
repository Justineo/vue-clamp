# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSIyLjUiIHk9IjIuNSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjE5IiByeD0iMy44IiBmaWxsPSIjRkZGRkZGIi8+PHJlY3QgeD0iNi4zIiB5PSIxMy41NSIgd2lkdGg9IjMuNyIgaGVpZ2h0PSIzLjciIHJ4PSIwLjkiIGZpbGw9IiNBOUE5QTkiLz48cGF0aCBkPSJNMTUuODUgNi40NUgxOC44NUwxMi41IDE5LjJIOS41TDE1Ljg1IDYuNDVaIiBmaWxsPSIjNTU1NTU1Ii8+PC9zdmc+&logoWidth=16)](https://npmx.dev/package/vue-clamp)

Clamping primitives for Vue 3. The package includes components for multiline text, trusted inline
HTML, single-line strings with fixed affixes and configurable ellipsis placement, and wrapped item
lists.

- Documentation and demo: [vue-clamp.void.app](https://vue-clamp.void.app/)
- Package README: [packages/vue-clamp/README.md](packages/vue-clamp/README.md)
- Migration guide: [MIGRATION.md](MIGRATION.md)
- Release notes: [CHANGELOG.md](CHANGELOG.md)

## Packages

- `packages/vue-clamp`: published `vue-clamp` library.
- `packages/website`: documentation and demo site.

## Development

This workspace uses Vite+. Run project tasks through `vp`.

```bash
vp install
```

Run the full local readiness check:

```bash
vp run ready
```

Common commands:

```bash
vp check
vp test
vp run test:browser
vp run build
vp run website#dev
```
