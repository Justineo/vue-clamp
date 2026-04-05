# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSI1LjI1IiB5PSIxNC41IiB3aWR0aD0iMyIgaGVpZ2h0PSIzIiByeD0iMC43NSIgZmlsbD0iY3VycmVudENvbG9yIi8+PHBhdGggZD0iTTE2LjUgNS41SDE4LjZMMTMuMjUgMTguNUgxMS4xTDE2LjUgNS41WiIgZmlsbD0iY3VycmVudENvbG9yIi8+PC9zdmc+&logoColor=white)](https://npmx.dev/package/vue-clamp)

Clamping primitives for Vue.

Docs and demo: [vue-clamp.vercel.app](https://vue-clamp.vercel.app/)

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

- [https://vue-clamp.vercel.app/](https://vue-clamp.vercel.app/)

## Migrating from 0.x

`1.x` is the Vue 3 line and includes breaking changes from `0.x`.

- Migration guide: [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
- Release notes: [CHANGELOG.md](https://github.com/Justineo/vue-clamp/blob/main/CHANGELOG.md#100)
