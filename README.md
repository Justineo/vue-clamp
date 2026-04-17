# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSIyLjUiIHk9IjIuNSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjE5IiByeD0iMy44IiBmaWxsPSIjRkZGRkZGIi8+PHJlY3QgeD0iNi4zIiB5PSIxMy41NSIgd2lkdGg9IjMuNyIgaGVpZ2h0PSIzLjciIHJ4PSIwLjkiIGZpbGw9IiNBOUE5QTkiLz48cGF0aCBkPSJNMTUuODUgNi40NUgxOC44NUwxMi41IDE5LjJIOS41TDE1Ljg1IDYuNDVaIiBmaWxsPSIjNTU1NTU1Ii8+PC9zdmc+&logoWidth=16)](https://npmx.dev/package/vue-clamp)

Clamping primitives for Vue.

Docs and demo: [vue-clamp.void.app](https://vue-clamp.void.app/)

Package docs:

- Website: [vue-clamp.void.app](https://vue-clamp.void.app/)
- Package README: [packages/vue-clamp/README.md](packages/vue-clamp/README.md)
- Migration guide: [MIGRATION.md](MIGRATION.md)
- Release notes: [CHANGELOG.md](CHANGELOG.md)

## Development

## Rich text

`<LineClamp>` is the plain-text multiline surface. Use `<RichLineClamp>` for trusted inline
`html`. `<RichLineClamp>` preserves inline markup, clamps from the end, and expects trusted HTML.
Sanitize untrusted input first with the
[HTML Sanitizer API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API) where
available, or [DOMPurify](https://github.com/cure53/DOMPurify). Rich clamping is best-effort and
behavior-based: if the runtime can clone the markup back into the DOM and the rendered element stays
in inline flow, it can participate in clamping, including leaf custom elements and other inline
atomic nodes. Inline rich images must provide a deterministic rendered size before loading, set by
attributes or CSS.

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp test
```

- Run the browser-rendered DOM tests:

```bash
vp run test:browser
```

- Build the workspace:

```bash
vp run build -r
```

- Run the demo site:

```bash
vp run website#dev
```
