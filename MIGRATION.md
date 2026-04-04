# Migrating From 0.x To 1.0.0

`vue-clamp@1.0.0` is a Vue 3 rewrite of the package. The multiline clamp idea is still here, but a
few API decisions changed to fit Vue 3 and the new runtime model.

## Quick Checklist

- Upgrade the host app to Vue 3.
- Replace the default export with a named import.
- Move the clamped text from the default slot into the `text` prop.
- Rename `tag` to `as`.
- Remove `autoresize`.
- Replace `:expanded.sync` with `v-model:expanded`.
- If you styled internals, switch to the documented `data-part` hooks.

## Before And After

### 0.x

```vue
<template>
  <v-clamp autoresize :max-lines="3" :expanded.sync="expanded">
    {{ text }}

    <template #after="{ clamped, toggle }">
      <button v-if="clamped" type="button" @click="toggle">Toggle</button>
    </template>
  </v-clamp>
</template>

<script>
import VClamp from "vue-clamp";

export default {
  components: {
    VClamp,
  },
  data() {
    return {
      expanded: false,
      text: "Some very very long text content.",
    };
  },
};
</script>
```

### 1.0.0

```vue
<script setup lang="ts">
import { ref } from "vue";
import { LineClamp } from "vue-clamp";

const expanded = ref(false);
const text = "Some very very long text content.";
</script>

<template>
  <LineClamp v-model:expanded="expanded" :text="text" :max-lines="3">
    <template #after="{ clamped, toggle }">
      <button v-if="clamped" type="button" @click="toggle">Toggle</button>
    </template>
  </LineClamp>
</template>
```

## Breaking Changes

### Vue 3 Only

`1.0.0` drops Vue 2 support. Upgrade the host app before migrating `vue-clamp`.

### No Default Export

`0.x` exported a single default component. `1.0.0` exports named components:

- `LineClamp`
- `InlineClamp`
- `WrapClamp`

### Text Source Moves To `text`

In `0.x`, the default slot was the multiline text source and had to be plain text. In `1.0.0`,
`LineClamp` takes its source text from the `text` prop instead:

```vue
<LineClamp :text="text" :max-lines="3" />
```

The default slot is no longer used for the source text.

### `tag` Becomes `as`

Rename:

```vue
<v-clamp tag="section" />
```

to:

```vue
<LineClamp as="section" />
```

### `autoresize` Is Removed

Remove `autoresize`. The new runtime always observes the layout inputs it needs, including root and
slot size changes.

### `.sync` Becomes `v-model:expanded`

Replace:

```vue
<v-clamp :expanded.sync="expanded" />
```

with:

```vue
<LineClamp v-model:expanded="expanded" />
```

The underlying event remains `update:expanded`.

### Internal Styling Hooks Changed

If your app styled the old internal DOM tree directly, update those selectors. `1.0.0` only treats
the documented `data-part` hooks as stable:

- `LineClamp`: `root`, `content`, `before`, `body`, `after`
- `InlineClamp`: `root`, `start`, `body`, `end`
- `WrapClamp`: `root`, `content`, `before`, `item`, `after`

## Slot Compatibility

`LineClamp` still supports `before` and `after`, and the slot props remain familiar:

- `expand`
- `collapse`
- `toggle`
- `clamped`
- `expanded`

`WrapClamp` adds a new item-oriented surface for badge/tag layouts. Its `before` / `after` slot
props expose `hiddenItems` so you can build `+N`, `More`, or custom hidden-item UI.

## New Surfaces In 1.0.0

If you were using `0.x` to solve related truncation problems, `1.0.0` also adds two new
specialized components:

- `InlineClamp` for one-line affix-friendly truncation.
- `WrapClamp` for wrapped atomic items that must stay whole.
