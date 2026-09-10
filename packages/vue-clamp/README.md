# vue-clamp

[![GitHub stars](https://img.shields.io/github/stars/Justineo/vue-clamp?style=flat&logo=github)](https://github.com/Justineo/vue-clamp)
[![npmx version](https://img.shields.io/npm/v/vue-clamp?style=flat&label=npmx&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSIyLjUiIHk9IjIuNSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjE5IiByeD0iMy44IiBmaWxsPSIjRkZGRkZGIi8+PHJlY3QgeD0iNi4zIiB5PSIxMy41NSIgd2lkdGg9IjMuNyIgaGVpZ2h0PSIzLjciIHJ4PSIwLjkiIGZpbGw9IiNBOUE5QTkiLz48cGF0aCBkPSJNMTUuODUgNi40NUgxOC44NUwxMi41IDE5LjJIOS41TDE1Ljg1IDYuNDVaIiBmaWxsPSIjNTU1NTU1Ii8+PC9zdmc+&logoWidth=16)](https://npmx.dev/package/vue-clamp)

Clamping primitives for Vue 3. The default components measure real browser layout so text, inline
content, and wrapped items fit the space they are actually rendered into. A separate predictive
text entry is available for controlled, high-frequency resize workloads.

- Live docs and demos: [vue-clamp.void.app](https://vue-clamp.void.app/)
- Migration guide: [MIGRATION.md](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md)
- Release notes: [CHANGELOG.md](https://github.com/Justineo/vue-clamp/blob/main/CHANGELOG.md)

## Install

```bash
pnpm add vue-clamp
```

`vue-clamp` has a peer dependency on Vue `^3.5.0`. Install Vue too if your project does not already
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

The predictive component is an explicit subpath import:

```ts
import { LineClamp } from "vue-clamp/pretext";
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
<LineClamp :text="title" :max-lines="2" location="middle" boundary="word" ellipsis="..." />
```

Useful props:

- `text`: source text. Defaults to `""`.
- `max-lines`: maximum visible line count.
- `max-height`: maximum visible height. Numbers are treated as pixels.
- `ellipsis`: string inserted into clamped output. Defaults to `…`.
- `location`: `start`, `middle`, `end`, or a number from `0` to `1`. Defaults to `end`.
- `boundary`: `grapheme` or `word`. Defaults to `grapheme`. Use `word` to avoid partial words;
  single-line word-boundary clamping uses the measured JS path instead of native `text-overflow`.
- `expanded`: show the full text. Supports `v-model:expanded`.

`before` and `after` slots render inline with the text and receive
`{ expand, collapse, toggle, clamped, expanded }`.

## Predictive plain text

Keep the root entry by default. Choose `vue-clamp/pretext` when:

- many mounted plain-text clamps resize repeatedly;
- they use `boundary="word"`, end truncation, and `max-lines` without `max-height`; and
- typography is stable, a named font is loaded, and exact browser-only shaping is not required.

One-off clamps, native-eligible grapheme clamps, and measured fallbacks do not amortize the
approximately 20 kB gzip predictor payload.

```vue
<script setup lang="ts">
import { LineClamp } from "vue-clamp/pretext";
</script>

<template>
  <LineClamp class="title" :text="title" :max-lines="2" boundary="word" />
</template>

<style>
.title {
  font:
    16px Inter,
    sans-serif;
}
</style>
```

The subpath has the same public API and selects the cheapest compatible engine:

1. Native CSS for the standard default end/grapheme/`…` subset.
2. Pretext for word-boundary end truncation with `max-lines` and no `max-height`, including observed
   `before` and `after` widths and custom ellipses without forced line breaks.
3. The standard browser-measured engine for every other combination. This includes non-native
   grapheme clamping with a multiline `after` slot or a custom ellipsis, preserving the root entry's
   character-level cut points.

All modes share the standard DOM, accessibility, controls, events, and observation runtime. Before
prediction, the component caches the rendered font plus Pretext-supported `white-space`,
`word-break`, and numeric `letter-spacing`. Other CSS still renders but is outside the model, so
platform font metrics and features such as automatic hyphenation, contextual spacing, font features,
or dynamic typography can produce a conservative shorter prefix. CSS line clamping and overflow containment prevent extra
lines from painting. Pretext also documents `system-ui` as unsafe on macOS.

After preparation, eligible resizes perform no DOM geometry or computed-style reads. Prefer the root
entry whenever full browser CSS fidelity matters more than repeated-resize throughput.

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
- `boundary` can be `grapheme` or `word`. Defaults to `grapheme`; `word` avoids partial words
  inside supported text runs.
- Supported default-ellipsis `max-lines` cases use native CSS clamping. The authored rich DOM stays
  intact and the ellipsis is visual rather than an inserted text node.
- Passive inline elements can participate when they can be cloned back into the DOM and stay in
  inline flow.
- Empty elements without light DOM content are treated as atomic inline units.
- `br`, `wbr`, `img`, and outer `svg` elements have explicit handling when they stay in inline
  flow.
- Inline rich images must have deterministic rendered dimensions before loading, set by attributes
  or CSS.
- When custom behavior requires measured clamping, custom elements, duplicate IDs or named form
  controls, active embedded content, and inline event handlers fall back to the original HTML
  because connected probe clones would not be reliably inert.
- Markup unsupported by the measured inline-flow model falls back to the original HTML unchanged.

`before` and `after` slots receive the same control props as `<LineClamp>`.

## Single-line strings

Use `<InlineClamp>` for one-line text where part of the string should remain fixed while the body
shrinks. The `location` prop controls how body text is kept around the ellipsis; in tight spaces,
the body can become just the ellipsis.

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

The default unsplit `location="end"`, `boundary="grapheme"`, and `ellipsis="…"` combination keeps
the full source text in the DOM and uses native CSS overflow. `split`, start/middle truncation,
word boundaries, and custom ellipsis strings use live browser measurement so their exact semantics
are preserved.

Useful props:

- `text`: required source string.
- `ellipsis`: string inserted into the rewritten body. Defaults to `…`.
- `location`: how body text is kept around the ellipsis: `start`, `middle`, `end`, or a number from
  `0` to `1`. Defaults to `end`.
- `boundary`: `grapheme` or `word`. Defaults to `grapheme`; `word` avoids partial words in the
  rewritten body, falling back to grapheme cuts when no whole word can fit.
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

The required `item` slot receives `{ item, index }`. The `before` and `after` slots receive
`{ expand, collapse, toggle, clamped, expanded, hiddenItems }`.

## Events and instance methods

Both `<LineClamp>` variants, `<RichLineClamp>`, and `<WrapClamp>` emit:

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

The Pretext entry uses the same parts on native, predictive, and browser-measured paths.

## Notes

- `1.x` is the Vue 3 line. See the
  [migration guide](https://github.com/Justineo/vue-clamp/blob/main/MIGRATION.md) when upgrading
  from `0.x`.
- `ResizeObserver` is part of the browser baseline.
- Multiline native clamping uses the specified legacy `-webkit-line-clamp` combination. The
  unprefixed `line-clamp` property is not required.
