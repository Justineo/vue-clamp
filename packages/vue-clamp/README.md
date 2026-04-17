# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSIyLjUiIHk9IjIuNSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjE5IiByeD0iMy44IiBmaWxsPSIjRkZGRkZGIi8+PHJlY3QgeD0iNi4zIiB5PSIxMy41NSIgd2lkdGg9IjMuNyIgaGVpZ2h0PSIzLjciIHJ4PSIwLjkiIGZpbGw9IiNBOUE5QTkiLz48cGF0aCBkPSJNMTUuODUgNi40NUgxOC44NUwxMi41IDE5LjJIOS41TDE1Ljg1IDYuNDVaIiBmaWxsPSIjNTU1NTU1Ii8+PC9zdmc+&logoWidth=16)](https://npmx.dev/package/vue-clamp)

Clamping primitives for Vue 3. `vue-clamp` measures real browser layout so text, inline content,
and wrapped items fit the space they are actually rendered into.

- Live docs and demos: [vue-clamp.void.app](https://vue-clamp.void.app/)
- Migration guide: [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
- Release notes: [CHANGELOG.md](https://github.com/Justineo/vue-clamp/blob/main/CHANGELOG.md)

## Install

```bash
pnpm add vue-clamp
```

`vue-clamp` has a peer dependency on Vue `^3.3.0`. Install Vue too if your project does not already
depend on it.

## Components

| Component         | Use it for                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `<LineClamp>`     | Multiline plain text with optional start, middle, or end ellipsis.  |
| `<RichLineClamp>` | Trusted inline HTML that should keep formatting while clamping.     |
| `<InlineClamp>`   | One-line strings with fixed affixes and configurable ellipsis.      |
| `<WrapClamp>`     | Wrapped atomic items such as tags, filters, chips, and breadcrumbs. |

The package has named exports only:

```ts
import { InlineClamp, LineClamp, RichLineClamp, WrapClamp } from "vue-clamp";
```

## Quick start

```vue
<script setup lang="ts">
import { ref } from "vue";
import { LineClamp } from "vue-clamp";

const expanded = ref(false);
const text = "Ship review-ready notes with browser-fit text truncation and keep the toggle inline.";
</script>

<template>
  <LineClamp v-model:expanded="expanded" :text="text" :max-lines="2">
    <template #after="{ clamped, expanded, toggle }">
      <button v-if="clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : "More" }}
      </button>
    </template>
  </LineClamp>
</template>
```

## Plain text

Use `<LineClamp>` when the source is plain text and the browser should decide line wrapping.

```vue
<LineClamp :text="title" :max-lines="2" location="middle" ellipsis="..." />
```

Useful props:

- `text`: source text. Defaults to `""`.
- `max-lines`: maximum visible line count.
- `max-height`: maximum visible height. Numbers are treated as pixels.
- `ellipsis`: string inserted into clamped output. Defaults to `…`.
- `location`: `start`, `middle`, `end`, or a number from `0` to `1`. Defaults to `end`.
- `expanded`: show the full text. Supports `v-model:expanded`.

`before` and `after` slots render inline with the text and receive
`{ expand, collapse, toggle, clamped, expanded }`.

## Trusted rich text

Use `<RichLineClamp>` for trusted or already-sanitized inline markup.

```vue
<RichLineClamp v-model:expanded="expanded" :html="html" :max-lines="2">
  <template #after="{ clamped, expanded, toggle }">
    <button v-if="clamped" type="button" @click="toggle">
      {{ expanded ? "Less" : "More" }}
    </button>
  </template>
</RichLineClamp>
```

Rich clamping is intentionally scoped:

- `html` is rendered as HTML. Sanitize untrusted input before passing it in.
- Rich content clamps from the end only.
- Inline elements can participate when they can be cloned back into the DOM and stay in inline flow.
- Leaf elements without light DOM content are treated as atomic inline units, including custom
  elements.
- `br`, `wbr`, `img`, and outer `svg` elements have explicit handling when they stay in inline
  flow.
- Inline rich images must have deterministic rendered dimensions before loading, set by attributes
  or CSS.
- Unsupported markup falls back to the original HTML unchanged.

`before` and `after` slots receive the same control props as `<LineClamp>`.

## Single-line strings

Use `<InlineClamp>` for one-line text where part of the string should remain fixed while the body
shrinks. The `location` prop controls where the ellipsis appears inside that body.

```vue
<script setup lang="ts">
import { InlineClamp } from "vue-clamp";

const file = "summer-campaign-panorama-final.jpeg";

function splitFileName(text: string) {
  const extension = text.match(/\.[^.]+$/)?.[0];

  return extension ? { body: text.slice(0, -extension.length), end: extension } : { body: text };
}
</script>

<template>
  <InlineClamp :text="file" :split="splitFileName" location="middle" />
</template>
```

Useful props:

- `text`: required source string.
- `ellipsis`: string inserted into the rewritten body. Defaults to `…`.
- `location`: ellipsis position inside `body`: `start`, `middle`, `end`, or a number from `0` to
  `1`. Defaults to `end`.
- `split`: optional function returning `{ start?: string, body: string, end?: string }`.
- `as`: root tag name. Defaults to `span`.

`<InlineClamp>` has no slots or expansion API.

## Wrapped items

Use `<WrapClamp>` when each item must stay whole.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { WrapClamp } from "vue-clamp";

const expanded = ref(false);
const labels = [
  { id: "perf", label: "Performance" },
  { id: "a11y", label: "Accessibility" },
  { id: "docs", label: "Docs" },
  { id: "qa", label: "Needs QA" },
];
</script>

<template>
  <WrapClamp v-model:expanded="expanded" :items="labels" item-key="id" :max-lines="2">
    <template #item="{ item }">
      <span class="tag">{{ item.label }}</span>
    </template>

    <template #after="{ clamped, expanded, hiddenItems, toggle }">
      <button v-if="expanded || clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : `+${hiddenItems.length} more` }}
      </button>
    </template>
  </WrapClamp>
</template>
```

Useful props:

- `items`: ordered source items. Defaults to `[]`.
- `item-key`: string field name or `(item, index) => string | number` key resolver.
- `max-lines`: maximum visible wrapped line count.
- `max-height`: maximum visible height. Numbers are treated as pixels.
- `expanded`: show the full item list. Supports `v-model:expanded`.

The `item` slot receives `{ item, index }`. The `before` and `after` slots receive
`{ expand, collapse, toggle, clamped, expanded, hiddenItems }`.

## Events and instance methods

`<LineClamp>`, `<RichLineClamp>`, and `<WrapClamp>` emit:

- `clampchange`: `(clamped: boolean)`, emitted when truncation turns on or off.
- `update:expanded`: `(expanded: boolean)`, emitted for `v-model:expanded`.

They also expose `expand()`, `collapse()`, `toggle()`, `clamped`, and `expanded` through a template
ref.

## Styling hooks

Stable styling hooks use `data-part` attributes:

| Component         | Parts                                        |
| ----------------- | -------------------------------------------- |
| `<LineClamp>`     | `root`, `content`, `before`, `body`, `after` |
| `<RichLineClamp>` | `root`, `content`, `before`, `body`, `after` |
| `<InlineClamp>`   | `root`, `start`, `body`, `end`               |
| `<WrapClamp>`     | `root`, `content`, `before`, `item`, `after` |

Do not rely on internal DOM nesting as a styling contract.

## Notes

- `1.x` is the Vue 3 line. See the
  [migration guide](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md) when upgrading
  from `0.x`.
- `ResizeObserver` is part of the browser baseline.
