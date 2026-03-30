# Research and Design Draft for a New Vue Clamp Version Built on Pretext

## Conclusion

I think this is **worth prototyping as a new engine**, and the upside is likely bigger than just swapping out the internals for the same behavior.[P1][P2][V1][V2]

But my conclusion is not "Pretext should fully replace the current approach." It is:

- **A Pretext-based engine is worth building**
- **It should not replace the current DOM engine on day one**
- **The right architecture is probably dual-engine: Pretext engine plus DOM fallback**
- **Phase 1 should focus on end-clamp and text-first scenarios**
- **Rich `before` and `after` content can be supported, but only with explicit constraints and fallback rules** [P1][V2][V3]

---

## Background and Problem Framing

`vue-clamp` already covers a very practical feature set:

- clamp by `max-lines` or `max-height`
- auto-update on layout changes
- expand and collapse
- ellipsis placement at `start`, `middle`, or `end`
- `before` and `after` slots that can contain rich content
- but the clamped `default` slot itself must be **plain text** [V1][V2]

That last detail matters a lot, because it means the real problem `vue-clamp` is solving is not general rich-text layout. It is closer to:

> Clamp a plain-text body, with up to two boundary slots on the left and right side of the visible content.

That is important because it determines whether Pretext is actually a good fit.

Pretext's public API is currently strongest at exactly this kind of problem:

- one-time `prepare`
- repeated `layout`, `layoutWithLines`, `walkLineRanges`, and `layoutNextLine`
- avoiding DOM text measurement in the hot path
- moving the expensive work into `prepare()` and making repeated layout arithmetic-only [P1][P2]

So at the model level, **`vue-clamp` and Pretext are not misaligned**. In fact, they match unusually well around the "plain text core" assumption.[P1][V2]

---

## Why This Is Worth a New Engine Instead of More Incremental Tweaks

## 1. The current bottleneck is repeated DOM reads and writes plus boundary search

The current `vue-clamp` implementation depends on real browser layout and then uses DOM reads and writes to converge on the truncation boundary. From the implementation, it does things like:

- count lines via `getClientRects()`
- compare `scrollHeight` and `offsetHeight`
- rewrite `textContent`
- recursively binary-search toward the final truncation point [V3]

The upside of that model is obvious: it is naturally aligned with what the browser actually rendered.

The downside is equally obvious:

- every instance participates in real layout work
- lots of instances will recompute together during resize
- it is not especially cheap in dense card grids, virtual lists, masonry, or message streams [V3]

## 2. Pretext's advantage is not "single measurement is cheaper" but "repeated layout is cheaper"

Pretext is not valuable because it magically knows typography better than the browser. It is valuable because it restructures the work into:

- `prepare()`: one-time analysis, segmentation, measurement, caching
- `layout()`: arithmetic-only hot path [P1]

In the current published snapshot for a shared batch of 500 texts:

- `prepare()` is about 18.85ms
- `layout()` is about 0.09ms
- DOM interleaved is about 43.50ms in Chrome
- Safari's DOM path is even more expensive [P2]

This is **not** a head-to-head benchmark against `vue-clamp`, so it would be wrong to claim the new version will automatically be faster.  
But it does strongly suggest that if `vue-clamp`'s main pain point is **many instances relaying out repeatedly**, then the Pretext architecture has a real chance of improving that.[P2]

---

## The Most Likely New Capabilities It Could Unlock

## 1. Better resize and relayout performance with many instances

This is the clearest win.

Good candidate scenarios:

- feeds and card grids
- virtual lists
- message lists
- masonry
- panels with container widths that change often [P1][P2]

If text and font settings are relatively stable, and most recomputation comes from width changes, then a Pretext engine is much closer to the ideal "prepare once, reuse many times" model.[P1][P2]

## 2. Knowing in advance whether content will be clamped

Pretext treats height measurement and line layout as first-class operations.  
That means a new `vue-clamp` engine could naturally support things like:

- knowing `lineCount` before rendering
- knowing collapsed and expanded height before rendering
- deciding `clamped` before final paint
- deciding whether to show "Read more" before the browser has already done the full layout [P1]

That would move `vue-clamp` closer to a predictable layout component rather than a render-then-correct component.

## 3. Reuse outside the DOM

Pretext explicitly positions itself for DOM, Canvas, SVG, WebGL, and potentially server-side use later.[P1]

So if you ever want:

- a DOM `vue-clamp`
- a canvas-based clamp renderer
- truncation in an editor or design tool
- server-side height prediction to reduce layout shift

then a Pretext-based core is much more extensible than staying tied to DOM measurement forever.[P1]

## 4. More systematic support for multilingual edge cases

Pretext publicly emphasizes support for:

- emoji
- mixed bidi
- many languages
- a current browser sweep showing `7680/7680` in Chrome, Safari, and Firefox [P1][P2]

That does not mean it is equivalent to the full browser text engine.  
But for `vue-clamp`'s actual problem, namely plain-text body truncation, it provides a much more structured line-layout foundation than a simpler character-boundary plus DOM-search strategy.[P1][P2]

---

## Capabilities It Will Not Magically Provide

## 1. Arbitrary rich-text body content does not suddenly become easy

This is the most important false expectation to avoid.

`vue-clamp` currently documents that the `default` slot must be plain text.[V2]  
That is actually a positive sign for a Phase 1 Pretext engine.

But if the long-term goal is arbitrary rich text inside the main body, such as:

- mixed font weights and sizes
- inline links
- inline code
- mentions or chips
- custom inline components

then that is no longer "replace the engine for the same component." That is moving much closer to an inline rich-text layout engine.

Pretext's public API is still string-first today. It does have a rich-text demo showing text runs, links, code spans, and atomic chips laid out together. My read is:

> The direction is promising for richer inline layout, but the public API is still primarily a high-accuracy plain-text layout primitive.

That is a **positive signal**, but not something to treat as a finished public rich-text API today.[P1][R1]

## 2. Complex CSS text behavior will not come along automatically

Pretext is quite explicit about its supported scope. It mainly targets:

- `white-space: normal`
- `word-break: normal`
- `overflow-wrap: break-word`
- `line-break: auto`
- plus `pre-wrap` as an additional mode [P1]

It also explicitly warns that:

- `system-ui` is unsafe on macOS for layout accuracy
- named fonts are preferred [P1]

So if a new engine is built on Pretext, it has to accept a real constraint:

> It should not promise exact support for every possible browser text CSS combination.

A more honest design is:

- stronger performance and predictability inside the supported zone
- automatic fallback to the DOM engine outside it

## 3. Start and middle clamp are not as natural as end clamp

`end` clamp is the best first target because it maps cleanly to the idea of reserving width for ellipsis and `after` content on the final visible line.  
`middle` clamp is much harder because both the prefix and suffix of the body affect how the paragraph repacks.

So if this is rewritten, I would strongly recommend doing it in phases:

1. `end`
2. then possibly `start`
3. only later evaluate `middle`

rather than trying to make all three equivalent on day one.[V2]

---

## Design Principles

## 1. Do not do a single-engine revolution

Introduce an explicit engine abstraction:

```ts
type ClampEngine = "dom" | "pretext" | "auto";
```

Suggested semantics:

- `dom`: current behavior, compatibility-first
- `pretext`: new engine, performance and predictability first
- `auto`: use Pretext when constraints are satisfied, otherwise fall back to DOM

This avoids forcing vNext to solve every edge case immediately.

## 2. Redefine the problem as body layout plus boundary decorators

For the Pretext engine, split content into three parts:

- `before`
- `text`
- `after`

Where:

- `text` uses Pretext
- `before` and `after` are not treated as general-purpose rich-text trees
- instead they are treated as boundary inline objects with width and height behavior

This is far more realistic than trying to translate the entire Vue slot tree into a Pretext segment tree.

## 3. Use an atomic-first strategy for `before` and `after`

This is the design choice I would recommend most strongly.

### Definition of atomic-first

In the Pretext engine, `before` and `after` are treated by default as:

- single indivisible inline boxes
- not internally rewrapped by the Pretext engine
- contributing width and height occupancy only

Typical supported content:

- icons
- badges
- chips
- buttons
- "Read more"
- a single-line link
- other single-line rich inline fragments

This matches real `vue-clamp` usage patterns very well.[V1][V2]

### Why this is the right tradeoff

Because `vue-clamp`'s rich content is not "arbitrary rich text inside the body." It is "rich content on the left and right boundary of a clamped text body."

That aligns very well with Pretext's line-by-line width routing, especially `layoutNextLine()`, which already supports varying line widths.[P1]

### How to decide whether a slot can use the Pretext engine

Do one lightweight measurement of `before` and `after` in the DOM:

- if absent, width is zero
- if rendered as a single-line atomic box, record its inline size
- if it wraps internally or behaves like a more complex inline flow, fall back to the DOM engine

So the Pretext engine is not literally "zero DOM." It is better described as:

> zero DOM for the text layout hot path, plus low-frequency DOM measurement for boundary slots.

I think that tradeoff is very reasonable because it preserves one of `vue-clamp`'s most valuable API features without turning the problem into a full rich-text engine.

---

## Core Algorithm Design

## Scenario A: `end` clamp with no rich slots

This is the strongest Phase 1 target.

### Goal

Given:

- `text`
- `font`
- `lineHeight`
- `maxWidth`
- `maxLines`
- `ellipsis`

Compute:

- whether it is clamped
- the truncated text
- actual visible line count
- collapsed and expanded height

### Algorithm

1. Run `prepare(text, font, options)` once
2. Use `layoutWithLines` or `layoutNextLine` to compute the original line layout
3. If `lineCount <= maxLines`, do not clamp
4. If `lineCount > maxLines`:
   - keep the first `maxLines - 1` lines unchanged
   - reserve `ellipsisWidth` on the final visible line
5. Search within the final visible line only:
   - find the largest body prefix such that `lastLinePrefix + ellipsis` still fits
6. Output the cut cursor and final display string

### Key optimization

The current DOM engine is effectively probing the entire text repeatedly.  
A Pretext engine can reduce the problem to:

> stabilize the first N-1 visible lines, then fit only the final visible line locally.

That is much cleaner for both algorithmic complexity and hot-path performance.

---

## Scenario B: `end` clamp with an `after` slot

This is, in my view, the most valuable and most interesting extension.

### Goal

Support patterns like:

```vue
<v-clamp :max-lines="3">
  {{ text }}
  <template #after="{ toggle, clamped }">
    <button v-if="clamped" @click="toggle">Read more</button>
  </template>
</v-clamp>
```

### Difficulty

The `after` content may depend on `clamped`.  
That introduces a small loop:

- you need to know `clamped` to know what `after` looks like
- but `after` width affects how much body text fits
- which affects whether it is clamped

### Recommended approach: bounded fixed-point convergence

Use a maximum of 2 to 3 passes:

1. **Pass 1**
   - assume the unclamped `after` state
   - compute clamp result for the body
   - derive `clamped?`

2. **Pass 2**
   - render the real `after` for that `clamped` state
   - measure `afterWidth`
   - rerun the final-line fitting

3. If the second pass does not change the clamp state, it has converged
4. If it oscillates or the slot is too complex, fall back to the DOM engine

### Width routing

The final visible line gets:

```ts
availableWidth = containerWidth - afterWidth - ellipsisWidth;
```

If `before` also exists, then the first visible line gets:

```ts
firstLineWidth = containerWidth - beforeWidth;
```

Middle lines use the normal container width.  
This is exactly the kind of problem `layoutNextLine()` is designed for.[P1]

---

## Scenario C: `before` plus `after` plus `maxLines`

Suggested semantics:

- `before` affects only the first visible line
- `after` affects only the last visible line
- both are treated as atomic inline boxes
- if either slot wraps internally or exceeds single-line inline semantics, fall back to DOM

This keeps the problem tractable.

---

## Scenario D: `maxHeight`

`vue-clamp` currently supports height-based clamping as well.[V1]

In the Pretext engine, `maxHeight` can be handled at two levels.

### Simple level

Infer:

```ts
maxLines = floor(maxHeight / lineHeight);
```

Then reuse the line-based clamp logic.

### Risk level

If `before` or `after` contains non-text inline boxes, true line box height may not equal the plain-text `lineHeight`.  
So I would recommend:

- support it for plain-text body plus atomic side slots
- fall back to DOM if the side slots exceed single-line inline semantics

---

## A Realistic Rich Content Strategy

## Rich content that should be supported in Phase 1

I would explicitly support:

- single-line icons
- badges and chips
- single-line links
- buttons
- code-like pills
- fixed-size inline components

Because they can all be modeled as atomic inline boxes.

Pretext's rich-text demo already shows:

- text runs
- links
- code spans
- atomic chips
- chips staying whole rather than being broken apart [R1]

That suggests the underlying direction is compatible with richer inline semantics.  
But for a new `vue-clamp` engine, there is still no reason to jump all the way to arbitrary rich-text body content in the first version.[P1][R1]

## Rich content that should not be supported in Phase 1

- arbitrary rich text inside the `default` slot
- `before` and `after` that wrap internally
- side content made of several independently wrapping inline fragments
- slot content that depends on complex baseline alignment with the body
- text styles outside Pretext's current supported CSS scope [P1]

---

## Recommended External API Design

## 1. Preserve the current surface API

Keep:

- `max-lines`
- `max-height`
- `ellipsis`
- `location`
- `expanded`
- `before`
- `after`
- `clampchange`

That minimizes migration cost.[V1][V2]

## 2. Add engine selection

```ts
engine?: 'dom' | 'pretext' | 'auto'
```

Suggested default:

- probably `auto`, but only after clearly documenting when the Pretext engine is valid

## 3. Add side-slot handling policy

I would consider an option like:

```ts
sideSlots?: 'atomic' | 'auto' | 'dom'
```

Semantics:

- `atomic`: require `before` and `after` to behave as indivisible inline boxes
- `auto`: use atomic if possible, otherwise fall back
- `dom`: always delegate side-slot handling to the DOM engine

## 4. Add debug and observability hooks

To make this maintainable, I would recommend exposing debugging hooks such as:

```ts
@enginechange="..."
@fallback="..."
@metrics="..."
```

This would help surface:

- which engine was used
- why a fallback occurred
- line counts
- measured widths
- prepare and layout timings

That would make the new engine much easier to validate and support over time.

---

## Recommended Internal Architecture

## 1. A unified engine interface

```ts
interface ClampLayoutEngine {
  measure(input: ClampInput): ClampOutput;
}
```

`ClampInput` should include at least:

- text
- font
- lineHeight
- width
- maxLines or maxHeight
- ellipsis
- location
- beforeWidth
- afterWidth
- white-space mode
- locale

That allows both the DOM engine and the Pretext engine to implement the same interface.

## 2. Split the Pretext engine into two layers

### Layer A: Text Core

Responsible for:

- prepare caching
- line layout
- line count
- final cut cursor

### Layer B: Boundary Decorators

Responsible for:

- slot measurement
- ellipsis width
- fixed-point reruns
- fallback decisions

This keeps body layout separate from slot-richness handling.

## 3. Cache strategy

Pretext already has internal cache and exposes `clearCache()` and `setLocale()`.[P1]

At the component layer, an extra lightweight cache would still be valuable:

- key = `(text, font, whiteSpace, locale)`
- value = prepared handle

That should pay off significantly when many cards share the same font and text settings.

---

## Where the Real Gains Are Most Likely

## High-value scenarios

- 100 to 1000 clamp instances on screen
- frequent window resize or container resize
- feeds, lists, message threads
- card grids and masonry
- wanting to know `clamped` before final rendering
- many multilingual strings
- future canvas, SVG, or server-side-ish prelayout ambitions [P1][P2]

## Medium-value scenarios

- ordinary pages with dozens of card summaries
- `before` and `after` are present but mostly buttons, badges, or icons
- expand and collapse transitions benefit from predictable height [V1][V2]

## Low-value scenarios

- only a few clamp instances on a page
- text and layout rarely change
- the main requirement is just "works"
- heavy reliance on text CSS outside Pretext's supported zone [P1]

---

## The Three Things I Would Validate First

## 1. Whether end-clamp is meaningfully better than the current implementation

This is the first priority.  
If this alone lands, the new engine already has product value.

Metrics to compare:

- mount p50 and p95
- resize p50 and p95
- total time for 100 and 1000 instances
- number of DOM reads and writes
- visual correctness

## 2. Whether atomic `before` and `after` cover most real usage

This determines whether Pretext is genuinely a good fit for `vue-clamp`.

I would strongly recommend a usage audit:

- inspect real projects using `before` and `after`
- measure how many can be treated as single-line atomic boxes

If 70 to 90 percent of usage is badge, button, link, icon, and similar cases, this path becomes very compelling.

## 3. Whether slot content depending on `clamped` converges reliably

This needs to be tested early.  
If most cases converge in 2 passes, then the new engine is very viable for `after`-slot scenarios.  
If oscillation is common, then either semantics need tightening or fallback needs to be broadened.

---

## Suggested Delivery Plan

## Phase 0: experimental prototype

Only support:

- `engine="pretext"`
- plain-text body
- `location="end"`
- no `before` or `after`
- `max-lines`

Goal:

- establish correctness and baseline benchmark behavior

## Phase 1: add atomic `after`

Support:

- `after` as a single-line atomic box
- 2-pass convergence for slot content depending on `clamped`

Goal:

- support the canonical "Read more" use case

## Phase 2: add atomic `before`

Support:

- first-line width reduction for `before`
- final-line width reduction for `after + ellipsis`

Goal:

- cover most boundary-decorator patterns

## Phase 3: add auto fallback

Support:

- fallback when side slots are too complex
- fallback when CSS is outside Pretext's supported zone
- warning or fallback for known risky fonts like `system-ui` [P1]

## Phase 4: revisit `start` and `middle`

Especially `middle`, which should not be prioritized until the earlier phases are clearly successful.

---

## Final Recommendation

## What I would do

I would start a **Vue Clamp Next engine prototype**, but frame the goal as:

> Build a text-first, line-aware, hot-path-cheap clamp engine on top of Pretext, while keeping the current DOM engine alongside it.

Not:

> Replace the current `vue-clamp` implementation with the same behavior and a different dependency.

## What success would look like

This project succeeds not because it is theoretically more sophisticated, but because it achieves at least one of these in practice:

1. clearly better hot-path performance in many-instance, high-frequency relayout scenarios
2. clearly unlocks capabilities the current DOM engine is not well suited for, such as:
   - predictive `clamped` state
   - reuse outside the DOM
   - more predictable multilingual line layout
   - lower-cost virtualized or masonry use cases [P1][P2]

## My overall judgment

**This is worth doing.**

But I would position it as:

- **a strong upgrade for plain-text body clamping**
- **a practical upgrade for atomic `before` and `after` content**
- **controlled support for richer boundary content**
- **deliberate non-support, at first, for arbitrary rich text**

If the direction is executed well, this would not just be "a faster `vue-clamp`." It would be an opportunity to evolve `vue-clamp` from a DOM-search truncation component into a more predictable text-layout component.

---

## Appendix: one-sentence summary

If the goals are:

- preserve the value of the current API
- improve hot-path performance for many instances
- create a stronger foundation for future layout capabilities

then my view is:

> **Rebuilding a new engine on top of Pretext is a very worthwhile investment, as long as you accept an atomic-first side-slot model and the fact that DOM fallback will remain part of the architecture for the foreseeable future.**
