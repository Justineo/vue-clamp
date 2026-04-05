# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=plastic&logo=github)](https://github.com/Justineo/vue-clamp)
[![npm version](https://img.shields.io/npm/v/vue-clamp?logo=npm)](https://www.npmjs.com/package/vue-clamp)

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

## Development

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
