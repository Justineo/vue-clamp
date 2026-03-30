# vue-clamp

Vue 3 multiline text clamping powered by `@chenglou/pretext`.

## Install

```bash
pnpm add vue-clamp vue
```

## Usage

```vue
<script setup lang="ts">
import { ref } from "vue";
import Clamp from "vue-clamp";

const expanded = ref(false);
</script>

<template>
  <Clamp v-model:expanded="expanded" :max-lines="2">
    A long line of text that should be clamped after two lines.
    <template #after="{ clamped, toggle }">
      <button v-if="clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : "More" }}
      </button>
    </template>
  </Clamp>
</template>
```

## API

- Props: `tag`, `autoresize`, `maxLines`, `maxHeight`, `ellipsis`, `location`, `expanded`
- Slots: default plain-text slot, `before`, `after`
- Emits: `update:expanded`, `clampchange`
- Exposed instance: `expand()`, `collapse()`, `toggle()`, `clamped`, `expanded`

## Constraints

- The default slot is plain text only. Rich content inside the default slot is not supported.
- `before` and `after` are measured as single inline boxes. They can render rich Vue content, but clamp math assumes each slot occupies one atomic inline width.
- Accurate clamping depends on measured width, font, and line height, so collapsed client renders stay hidden until the first measured clamp result is ready.
- `maxHeight` is resolved through measured line height, so unusually tall inline content can still diverge from exact browser line-box behavior.
