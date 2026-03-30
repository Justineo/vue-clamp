# Code Review: vue-clamp v0.5.0 (Vue 3 Rebuild)

Reviewer: Claude Opus 4.6 | Date: 2026-03-30

Scope: `packages/vue-clamp/src/`, `tests/`, root config, CI, `apps/website/`

---

## 1. `clamp.ts` — Core Clamping Algorithm

### 1.1 `buildCandidateDisplayText` loses a grapheme in middle mode when keptGraphemeCount is odd

```ts
// clamp.ts:142-148
const split = Math.floor(keptGraphemeCount / 2);
const prefix = joinGraphemes(graphemes, 0, split).trim();
const suffix = joinGraphemes(
  graphemes,
  Math.max(0, graphemes.length - split),
  graphemes.length,
).trim();
```

When `keptGraphemeCount` is odd (e.g. 9), `split = 4`, so both the prefix and suffix take 4 graphemes each, preserving only 8 instead of 9. This means the binary search may find a solution that could display one more grapheme, but that grapheme is silently dropped here.

**Suggestion:** Use `keptGraphemeCount - split` for the suffix length so that the prefix and suffix always sum to `keptGraphemeCount`:

```ts
const prefixCount = Math.floor(keptGraphemeCount / 2);
const suffixCount = keptGraphemeCount - prefixCount;
```

### 1.2 `getSource` redundant trim

```ts
// clamp.ts:90
const normalizedText = text.trim();
```

`VueClamp.ts:244` already trims in `syncText` (`const nextText = nextValue.trim()`), so the `sourceText` passed to `getSource` is already trimmed. The second trim in `getSource` is redundant. This is not a bug, but unnecessary duplication. If `getSource` needs to remain defensive as a public-facing API, at least add an internal comment explaining why.

### 1.3 `countPreparedLinesWithBeforeWidth` first-line edge case

```ts
// clamp.ts:230
const shareFirstTextLine = beforeWidth < containerWidth;
const firstLineWidth = Math.max(containerWidth - beforeWidth, 0);
```

When `beforeWidth === containerWidth`, `shareFirstTextLine` is `false`. In this case `firstTextLine` stays true but `maxWidth` uses `containerWidth` rather than `firstLineWidth`. The before slot and first text line each occupy their own line, which is correct. However, when `beforeWidth` is only a sub-pixel smaller than `containerWidth` (e.g. 299.99 vs 300), the code enters the `shareFirstTextLine = true` branch with a first-line available width of 0.01px, causing `layoutNextLine` to return only the first grapheme — unlikely to be the user's expectation. Consider adding a reasonable minimum threshold (e.g. 1px), or documenting this behavior in the design doc.

### 1.4 Binary search behavior when `bestKeptGraphemeCount = 0`

```ts
// clamp.ts:333
let bestKeptGraphemeCount = 0;
```

If even keeping 0 graphemes (i.e. ellipsis only) still exceeds the line limit, `bestKeptGraphemeCount` remains 0, and `getPreparedCandidate(source, location, ellipsis, 0)` returns a `displayText` consisting of only the ellipsis itself. This edge-case behavior is reasonable, but should be covered by a test case.

### 1.5 `candidateCache` unbounded growth

`Source.candidateCache` is a `Map<string, Candidate>`. If the user frequently changes ellipsis or location, cache key combinations grow indefinitely. Although the entire Source is rebuilt (clearing the cache) when text or font changes via `getSource`, switching between different location/ellipsis values on the same source can accumulate many entries.

For typical usage (fixed ellipsis + location, only width changes triggering different keptGraphemeCount values), this is not a problem. But if the user dynamically switches location (as the demo page does), the cache grows with every keptGraphemeCount tried during each binary search.

**Suggestion:** Not high priority, but consider clearing the cache when location or ellipsis changes, or setting an upper bound.

---

## 2. `VueClamp.ts` — Component Implementation

### 2.1 `rootStyle()` still sets `overflow: "hidden"` when `open.value = true`

```ts
// VueClamp.ts:139-145
if (open.value) {
  return {
    maxHeight: undefined,
    overflow: "hidden",
  };
}
```

The expanded state still sets `overflow: "hidden"`. If the user's default slot text happens to fill the container without a maxHeight constraint, there is no visual issue. However, if the user passes additional child elements or styles on the root element via attrs (`inheritAttrs: false` + `mergeProps(attrs, ...)`), `overflow: "hidden"` may clip unexpected content.

**Suggestion:** Consider removing `overflow: "hidden"` in the expanded state or changing it to `overflow: "visible"`, so that the expanded state behaves more like a natural unclamped layout.

### 2.2 Inconsistent `maxHeight` reading in `recompute()`

```ts
// VueClamp.ts:191
const maxHeight = parsePx(getComputedStyle(root).maxHeight);
```

In the collapsed state, `rootStyle()` sets `maxHeight` to a computed value (e.g. `min(calc(48px + 12em), 40px)`). `recompute()` reads `getComputedStyle(root).maxHeight`, which is the browser-resolved value, and passes it to `computeClampText` as the `maxHeight` parameter (which feeds into `resolveMaxLines`'s `maxHeight / lineHeight` path).

The issue: if `props.maxHeight` is a string (e.g. `"calc(48px + 12em)"`), `rootStyle()` sets that string on the style, and `recompute()` reads `getComputedStyle(root).maxHeight` as the browser-resolved px value. This is correct in most cases — but if `rootStyle()` also produces a `lineClampHeight` based on `lineHeightPx`, then `getComputedStyle` returns whichever is smaller from the `min()`, and `computeClampText`'s `maxHeight` parameter may actually be the `lineClampHeight` value rather than the user-supplied maxHeight.

This means when both `maxLines` and `maxHeight` are set, `resolveMaxLines` in `computeClampText` receives a `maxHeight` that is already the result of `min(explicitMaxHeight, lineClampHeight)`. But `resolveMaxLines` internally also processes both `maxLines` and `maxHeight`, causing the `maxHeight` constraint to be "indirectly applied twice" — once in the CSS `max-height`'s `min()`, and once in `resolveMaxLines`'s internal `Math.min(...limits)`.

Although the final result (taking the strictest constraint) is numerically correct, this path is not intuitive. If someone later modifies `rootStyle()` to stop emitting `lineClampHeight`, the clamping algorithm would silently change behavior.

### 2.3 `slotSnapshotText` assignment in the render function is a side effect

```ts
// VueClamp.ts:363-364
const nextSlotText = collectText(slots.default?.());
slotSnapshotText = nextSlotText;
```

Assigning to a closure variable inside the render function is a side effect. Vue's render function should theoretically be a pure function. Although Vue 3's rendering system does not double-invoke render like React StrictMode, so this is not a problem in practice, it is a notable design trade-off. `design.md` already mentions this choice ("Source text is captured from the render-phase slot snapshot"), so it is intentional — but a comment in the code explaining the rationale would help prevent future maintainers from misunderstanding.

### 2.4 `shouldRenderSourceText` logic may flash full text at specific timings

```ts
// VueClamp.ts:374-376
const shouldRenderSourceText =
  open.value || nextSlotText.length === 0 || !hasLimitNow || displayText.value.length === 0;
const renderedText = shouldRenderSourceText ? nextSlotText : displayText.value;
```

When `displayText.value.length === 0` (initial state, or text just changed but clamp result not yet ready), the full `nextSlotText` is displayed. This is an extension of the `design.md` strategy: "SSR renders unclamped full text first." But on CSR first mount with long text, there will be one frame of full text flash before collapsing to the clamped state.

The test case "does not render the full updated slot text before the new clamp result is ready" verifies the **text update** scenario won't flash — but that relies on `displayText.value` still holding the previous round's value. On **first mount**, `displayText.value` is indeed an empty string, so that one-frame flash of full text does exist.

**Suggestion:** If the first-frame flash is unacceptable in practice, consider initializing `displayText` to a sentinel value to distinguish "not yet computed" from "computed result is empty."

### 2.5 ResizeObserver creation via `??=` in `watchPostEffect`

```ts
// VueClamp.ts:294
resizeObserver ??= new ResizeObserver(() => {
  queue();
});
```

The `watchPostEffect` callback re-runs when dependencies change. Due to `??=`, the ResizeObserver instance is created only once; subsequent runs only update the observed elements. This is correct. However, `onCleanup` only unobserves the current run's elements, while the previous run's elements (if refs point to the same DOM nodes) are already unobserved, so the ResizeObserver instance may briefly have no observed targets. This doesn't cause bugs, but `disconnect()` is only called in `onBeforeUnmount`.

### 2.6 `aria-label` on an element with no implicit ARIA role

```ts
// VueClamp.ts:402
"aria-label": nextSlotText,
```

For an inline `<span>` element, `aria-label` is typically not announced by screen readers because `<span>` has no implicit ARIA role. If the intent is to make the full text available to assistive technologies, a `role="text"` should be added, or the `aria-label` should be placed on the root element. The current implementation may not achieve its accessibility goal.

---

## 3. `measurement.ts`

### 3.1 `fontShorthand` fallback concatenation may produce invalid font shorthand

```ts
// measurement.ts:15-28
const parts = [
  style.fontStyle,
  style.fontVariant,
  style.fontWeight,
  style.fontStretch,
  style.fontSize,
  style.fontFamily,
].filter((part) => part && part !== "normal");

if (parts.length > 0) {
  return parts.join(" ");
}

return `${style.fontSize || "16px"} ${style.fontFamily || "sans-serif"}`;
```

CSS font shorthand syntax requires both `font-size` and `font-family`, with `font-size` immediately preceding `font-family` (optionally separated by `/line-height`). If `fontSize` is non-empty but `fontFamily` happens to be an empty string, the filtered `parts` array contains only fontSize, producing a result like `"16px"` which is not a valid font shorthand. Pretext's behavior when receiving an invalid font value depends on its internal implementation.

In practice this almost never happens (browser computed styles always return fontFamily), but as a standalone function, `fontShorthand`'s contract should be more robust.

---

## 4. `slot-text.ts`

### 4.1 Children extraction for non-Text/Fragment/Comment nodes

```ts
// slot-text.ts:35-36
// (falls through to:)
pushText(parts, node.children);
```

For custom component VNodes (where `node.type` is an object), `node.children` may be a slot function rather than a VNode array. In that case `pushText` enters the `typeof value !== "object"` branch and silently ignores it. This is safe — no errors are thrown — but it also means that if a user nests custom components inside the default slot, their text content is silently discarded. Rather than only documenting "plain text only" in design.md, consider emitting a `console.warn` in dev mode for non-text VNodes.

---

## 5. Tests

### 5.1 Implicit `Intl.Segmenter` assumption in `clamp.test.ts` mock

`clamp.ts:99` uses `Intl.Segmenter` for grapheme segmentation. The tests mock Pretext but do not mock `Intl.Segmenter` — they rely on Node.js's native implementation. All test text is ASCII, where `Array.from(text)` and grapheme segmentation produce identical results. But if tests included emoji (e.g. `👨‍👩‍👧‍👦`), grapheme segmentation results would diverge from Pretext mock's `Array.from(text)` character-level splitting, causing test behavior to differ from production.

**Suggestion:** Add at least one test case with multi-codepoint graphemes (e.g. emoji or combining characters) to verify consistency between grapheme segmentation and the Pretext mock.

### 5.2 Default height value in test setup's `getBoundingClientRect`

```ts
// tests/setup.ts:125
const height = Number.parseFloat(dataHeight ?? "") || 20;
```

The default height is 20, which happens to match `line-height: 20px` in the tests. If someone changes the test's line-height without updating this default, tests will exhibit hard-to-debug behavioral differences. Consider extracting the default value into a named constant.

### 5.3 Missing test scenarios

- Component-level tests for `location="start"` and `location="middle"` (currently only covered by clamp algorithm unit tests)
- Component behavior when `maxHeight` is a string value
- `autoresize: false` should not cause ResizeObserver to observe the root element
- Cleanup verification: ResizeObserver and font listener cleanup after component unmount
- External `expanded` prop control syncing with internal `open` state

---

## 6. Engineering & Configuration

### 6.1 Empty `packages/utils` package

This directory contains only `.gitignore` and empty `src/` and `tests/` directories, with no `package.json`. The `packages/*` glob in `pnpm-workspace.yaml` matches it. Although the missing `package.json` means pnpm won't treat it as a package, the empty directory's presence is confusing.

**Suggestion:** Remove it, or add a package.json describing its intended purpose.

### 6.2 CI runs on a single Node version only

```yaml
# .github/workflows/ci.yml
runs-on: ubuntu-latest
```

`design.md` states "CI should run ... on supported Node versions," but the actual CI runs on ubuntu-latest (a single Node version) only. `package.json` requires `node >= 22.12.0`, but there is no CI matrix to verify the boundary version.

### 6.3 Benchmark code lives inside `src/`

The 4 files under `packages/vue-clamp/src/benchmark/` are not part of the library's entry tree, but reside within `src/`. `vp pack src/index.ts --dts` should only bundle modules reachable from `index.ts`, so they won't appear in the output. However, these files participate in `vp check` (type-checking and linting), and if benchmark code introduces dependencies or standards different from the library, it may cause unnecessary check overhead.

More importantly, if someone in the future exports benchmark-related types from `src/clamp.ts`, the tree-shaking boundary would be broken.

**Suggestion:** Move benchmark code to `packages/vue-clamp/benchmark/` or a standalone directory at the repo root.

### 6.4 `pnpm-workspace.yaml` uses `latest` tag for dependency

```yaml
vite-plus: latest
```

The `latest` tag resolves to the current latest version on every `pnpm install`. If upstream publishes a breaking change, CI and local builds could suddenly fail. The lockfile pins the version, but Renovate updating the lockfile may introduce an incompatible version.

---

## 7. Website (`apps/website`)

### 7.1 `App.vue` code highlighting runs only once on mount

```ts
// App.vue:95-97
onMounted(() => {
  highlightCodeBlocks();
});
```

The code snippets in the template are static (`installSnippet`, `usageSnippet` are not reactive), so running once is correct. But if code snippets need to change with language switching in the future (e.g. Chinese-commented versions), re-highlighting in a watcher would be necessary. Not a bug currently, just a maintenance note.

### 7.2 `BenchmarkPage.vue` not reviewed in depth

Since the benchmark page is a standalone performance tool rather than a core library feature, it is outside the focus of this review.

---

## Summary

| Category                 | Severity | Count                               |
| ------------------------ | -------- | ----------------------------------- |
| Logic defect             | Medium   | 1 (middle mode grapheme loss — 1.1) |
| Edge-case behavior       | Low      | 3 (1.3, 1.4, 2.4)                   |
| Design / maintainability | Low      | 5 (2.1, 2.2, 2.3, 3.1, 4.1)         |
| Accessibility            | Medium   | 1 (2.6)                             |
| Test coverage            | Low      | 3 (5.1, 5.2, 5.3)                   |
| Engineering config       | Low      | 4 (6.1–6.4)                         |

Top priority recommendations:

1. **Fix 1.1** — Middle mode drops a grapheme when `keptGraphemeCount` is odd
2. **Fix 2.6** — `aria-label` on a `<span>` without an ARIA role may not be effective for accessibility
3. **Expand 5.3** — Critical paths lack component-level test coverage
