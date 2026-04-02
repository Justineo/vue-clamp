# vue-clamp

Vue 3 line and inline text clamping with browser-aligned DOM primitives.

## Install

```bash
pnpm add vue-clamp vue
```

## Usage

```vue
<script setup lang="ts">
import { ref } from "vue";
import { LineClamp } from "vue-clamp";

const expanded = ref(false);
const text = "A long line of text that should be clamped after two lines.";
</script>

<template>
  <LineClamp v-model:expanded="expanded" :text="text" :max-lines="2">
    <template #after="{ clamped, toggle }">
      <button v-if="clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : "More" }}
      </button>
    </template>
  </LineClamp>
</template>
```

The package exports:

- `LineClamp` for the existing multiline clamp
- `InlineClamp` for a native one-line clamp with optional `split(text) => { start?, body, end? }`
- `Clamp` as a compatibility alias of `LineClamp`

`InlineClamp` is also available from the dedicated `vue-clamp/inline` entry.

## API

- `LineClamp`
  - Props: `as`, `autoresize`, `text`, `maxLines`, `maxHeight`, `ellipsis`, `location`, `expanded`
  - Slots: `before`, `after`
  - Emits: `update:expanded`, `clampchange`
  - Exposed instance: `expand()`, `collapse()`, `toggle()`, `clamped`, `expanded`

- `InlineClamp`
  - Props: `as`, `text`, `split`
  - No slots, emits, or exposed instance contract

`location` accepts `"start"`, `"middle"`, `"end"`, or a numeric ratio from `0` to `1`. Ratios map to where the preserved text budget sits around the ellipsis: `0` keeps the suffix, `0.5` splits evenly, and `1` keeps the prefix.

## Constraints

- The text to clamp comes from the `text` prop.
- `before` and `after` are measured as single inline boxes. They can render rich Vue content, but clamp math assumes each slot occupies one atomic inline width.
- The collapsed one-line end case with the default `…` ellipsis may use native CSS `text-overflow`. That native path applies to `location="end"` and `location={1}`. In that path, the DOM text remains the full source string and the ellipsis is visual. `before` and `after` stay fixed while the text portion shrinks.
- When the component must rewrite the visible string, it keeps a visually hidden full-text node in the DOM for assistive tech and marks only the rewritten visible text as presentational.
- The component follows live browser layout directly. Its collapsed root only applies explicit `maxHeight`; it does not derive a synthetic line-based clip.
