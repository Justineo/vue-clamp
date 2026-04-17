# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSIyLjUiIHk9IjIuNSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjE5IiByeD0iMy44IiBmaWxsPSIjRkZGRkZGIi8+PHJlY3QgeD0iNi4zIiB5PSIxMy41NSIgd2lkdGg9IjMuNyIgaGVpZ2h0PSIzLjciIHJ4PSIwLjkiIGZpbGw9IiNBOUE5QTkiLz48cGF0aCBkPSJNMTUuODUgNi40NUgxOC44NUwxMi41IDE5LjJIOS41TDE1Ljg1IDYuNDVaIiBmaWxsPSIjNTU1NTU1Ii8+PC9zdmc+&logoWidth=16)](https://npmx.dev/package/vue-clamp)

Clamping primitives for Vue.

Docs and demo: [vue-clamp.void.app](https://vue-clamp.void.app/)

## Install

```bash
pnpm add vue-clamp vue
```

## Components

- `<LineClamp>` for multiline plain text
- `<RichLineClamp>` for trusted inline rich text
- `<InlineClamp>` for one-line strings such as filenames, paths, and emails
- `<WrapClamp>` for wrapped items such as tags, filters, and chips

## Usage

```vue
<script setup lang="ts">
import { LineClamp } from "vue-clamp";
</script>

<template>
  <LineClamp :text="text" :max-lines="2" />
</template>
```

## Rich text

Use `<RichLineClamp>` for trusted or already-sanitized inline markup:

```vue
<RichLineClamp :html="html" :max-lines="2" />
```

`<RichLineClamp>` is intentionally scoped:

- Rich content clamps from the end only.
- Pass only trusted HTML, or sanitize untrusted input with the
  [HTML Sanitizer API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API) where
  available, or [DOMPurify](https://github.com/cure53/DOMPurify), before binding `html`.
- Rich clamping is best-effort and behavior-based: elements can participate as long as the runtime
  can clone them back into the DOM and their rendered layout stays in inline flow.
- Leaf elements without light DOM content are treated as atomic inline units, including custom
  elements.
- `br`, `wbr`, `img`, and inline `svg` elements still keep explicit handling.
- Inline rich images must provide a deterministic rendered size before loading, set by attributes
  or CSS.
- Markup that renders outside inline flow still falls back to the original HTML unchanged.

## Docs

See the website for installation, examples, API, and live demos:

- [https://vue-clamp.void.app/](https://vue-clamp.void.app/)

## Migrating from 0.x

`1.x` is the Vue 3 line and includes breaking changes from `0.x`.

- Migration guide: [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
- Release notes: [CHANGELOG.md](https://github.com/Justineo/vue-clamp/blob/main/CHANGELOG.md)
