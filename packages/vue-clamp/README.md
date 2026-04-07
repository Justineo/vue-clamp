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

- `LineClamp` for multiline text
- `InlineClamp` for one-line strings such as filenames, paths, and emails
- `WrapClamp` for wrapped items such as tags, filters, and chips

## Usage

```vue
<script setup lang="ts">
import { LineClamp } from "vue-clamp";
</script>

<template>
  <LineClamp :text="text" :max-lines="2" />
</template>
```

## Docs

See the website for installation, examples, API, and live demos:

- [https://vue-clamp.void.app/](https://vue-clamp.void.app/)

## Migrating from 0.x

`1.x` is the Vue 3 line and includes breaking changes from `0.x`.

- Migration guide: [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
- Release notes: [CHANGELOG.md](https://github.com/Justineo/vue-clamp/blob/main/CHANGELOG.md#100)
