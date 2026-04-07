# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml,%253Csvg%2520xmlns%253D%2522http%253A%252F%252Fwww.w3.org%252F2000%252Fsvg%2522%2520width%253D%252224%2522%2520height%253D%252224%2522%2520viewBox%253D%25220%25200%252024%252024%2522%2520fill%253D%2522none%2522%253E%253Crect%2520x%253D%25222.5%2522%2520y%253D%25222.5%2522%2520width%253D%252219%2522%2520height%253D%252219%2522%2520rx%253D%25223.8%2522%2520fill%253D%2522%2523FAFAFA%2522%252F%253E%253Crect%2520x%253D%25226.3%2522%2520y%253D%252213.55%2522%2520width%253D%25223.7%2522%2520height%253D%25223.7%2522%2520rx%253D%25220.9%2522%2520fill%253D%2522%2523A9A9A9%2522%252F%253E%253Cpath%2520d%253D%2522M15.85%25206.45H18.85L12.5%252019.2H9.5L15.85%25206.45Z%2522%2520fill%253D%2522%25235B5B5B%2522%252F%253E%253C%252Fsvg%253E&logoWidth=16)](https://npmx.dev/package/vue-clamp)

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
