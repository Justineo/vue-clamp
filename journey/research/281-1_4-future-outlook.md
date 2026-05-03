# vue-clamp 1.4+ Future Outlook

This document outlines a future direction for `vue-clamp` after 1.3.0. The goal is not to redesign the library or expand the public API surface aggressively. The goal is to build on the current implementation and make the existing primitives faster, more predictable, and more robust across SSR, native CSS opportunities, rich content, and large wrapped item sets.

The main principle for 1.4+ should be:

```text
Keep the public API focused on clamping semantics.
Keep implementation strategies internal.
Use faster paths only when they are semantically equivalent.
Fall back to measured DOM truth whenever equivalence is uncertain.
```

## 1. Baseline in 1.3.0

The 1.3.0 implementation already has several important performance and correctness foundations.

### 1.1 Shared multiline measurement infrastructure

`LineClamp` and `RichLineClamp` share a multiline measurement shell that handles:

```text
ResizeObserver based recomputation
font loading driven recomputation
coalesced recompute scheduling
layout signature checks
same-flush Vue update handling
connected DOM probes
```

This means future work should avoid duplicating scheduling and measurement behavior in each component. Any new optimization should ideally plug into this existing recompute pipeline.

### 1.2 Text clamping already uses prepared boundaries and warm search

The plain text path already prepares text into boundary offsets and uses a search helper with warm hints. This avoids naive character-by-character truncation.

The current design is already centered around:

```text
prepare text once
search candidate lengths
measure actual browser layout
reuse previous clamp result as a hint
```

This is the right model. Future work should reduce the number and cost of DOM probes, not replace the correctness model wholesale.

### 1.3 Native single-line path already exists

`LineClamp` already has a native path for the narrow case where browser `text-overflow` semantics match the component semantics.

This path is intentionally conservative. It should remain conservative, but it can be extended in 1.4+ to cover more exact native cases.

### 1.4 RichLineClamp is structural, not string based

`RichLineClamp` parses and prepares trusted inline HTML, measures candidates in a connected probe, and patches structural clamp decisions back into the visible DOM.

This is a much heavier path than plain text. Future optimizations here should be careful and evidence driven. The main opportunities are caching, diagnostics, and benchmark coverage rather than aggressive algorithm replacement.

### 1.5 WrapClamp measures actual atomic boxes

`WrapClamp` treats before, items, and after as atomic inline-flex boxes. It measures their real browser geometry and settles visible item count based on actual line wrapping.

This is necessary because item widths and after slot output are arbitrary. The implementation should preserve that correctness model.

### 1.6 Benchmarks exist, but should become versioned assets

The project already has benchmark scripts for rich and wrap cases. The next step is to make benchmark results persistent, comparable across releases, and useful for regression detection.

---

## 2. Guiding Principles for 1.4+

### 2.1 Do not add a public `strategy` prop

Users should not have to choose between internal mechanisms such as:

```text
native
measured
pretext
binary
skeleton
early runtime
```

Those are implementation details. The component should choose the fastest safe implementation automatically.

Recommended direction:

```text
Public API:
  Describe desired clamping behavior.

Internal implementation:
  Pick the best safe path based on props, slots, browser support, text shape, and measurement results.
```

### 2.2 Preserve existing DX

In particular, `WrapClamp` should continue exposing `hiddenItems`.

`hiddenItems` is not merely a count. It enables:

```text
+N indicators
tooltips
popover content
overflow menus
remaining item summaries
localized after content
custom item rendering
```

Do not replace it with `hiddenCount`, a getter, or a lower-level API. If there is a cost to slicing hidden items, optimize internally without weakening the public slot interface.

### 2.3 Keep native paths semantically exact

Native CSS should only be used when it produces the same visual and semantic result as the component.

Approximate native rendering is not acceptable for cases involving:

```text
custom ellipsis
after slots
middle or start clamping
word boundaries
rich inline structure
arbitrary WrapClamp after content
```

When native CSS cannot express the exact semantics, the library should keep using the measured DOM path.

### 2.4 Treat DOM measurement as the source of truth

Even if faster predictors are introduced, such as Pretext, the final result should still be verified against real browser layout unless the native path is known to be semantically exact.

The long-term model should be:

```text
Predict fast when possible.
Verify with DOM when needed.
Fallback to existing measured search when prediction is uncertain.
```

---

## 3. LineClamp Native Fast Path Expansion

This is one of the most direct 1.4+ performance opportunities.

### 3.1 Current situation

`LineClamp` already has a native path for single-line end clamping with default ellipsis and grapheme boundary. It uses browser `text-overflow`.

This path should be kept, but the internal decision should be made more explicit.

### 3.2 Introduce internal native modes

Instead of treating native clamping as one boolean branch, use internal modes:

```ts
type NativeClampMode = "single-line" | "multi-line" | null;
```

This does not require a public API change.

### 3.3 Single-line native mode

For `maxLines === 1`, use `text-overflow`, not `line-clamp: 1`.

Conditions:

```ts
maxLines === 1 &&
  maxHeight == null &&
  location === "end" &&
  boundary === "grapheme" &&
  ellipsis === "…" &&
  !expanded;
```

Important point:

```text
before and after can both be supported in this mode.
```

The single-line native layout can use an inline-flex structure:

```text
before: fixed
body: flexible, min-width: 0, text-overflow
after: fixed
```

This preserves the intended visual model:

```text
[before] [clamped body…] [after]
```

### 3.4 Why not use `line-clamp: 1`

`text-overflow` and `line-clamp: 1` are not visually equivalent.

`text-overflow` means:

```text
Keep content on one line and ellipsize inline overflow.
```

`line-clamp: 1` means:

```text
Lay content out normally, then keep only the first line.
```

For text with natural wrapping opportunities, especially English words separated by spaces, the results can differ.

Example:

```text
Original:
Hello world from Vue

Possible text-overflow result:
Hello wor…

Possible line-clamp: 1 result:
Hello…
```

For `maxLines === 1`, `text-overflow` better matches the expected single-line truncation behavior.

### 3.5 Multiline native mode

For `maxLines > 1`, `line-clamp` can be used in a conservative exact subset.

Conditions:

```ts
maxLines > 1 &&
  maxHeight == null &&
  !hasAfter &&
  location === "end" &&
  boundary === "grapheme" &&
  ellipsis === "…" &&
  !expanded &&
  supportsLineClamp();
```

### 3.6 before is allowed in multiline native mode

A `before` slot is a prefix. If `line-clamp` is applied to a shared formatting context containing both before and body, the browser naturally accounts for the prefix when laying out the first lines.

The visual model remains correct:

```text
[before] [body continues and is clamped at the end]
```

Therefore:

```text
Do not exclude before from multiline native mode.
```

### 3.7 after is not allowed in multiline native mode

An `after` slot is a suffix. The intended model is:

```text
[before] [clamped body…] [after]
```

Native `line-clamp` cannot reliably express this.

If the after content is placed inside the clamped container, it may be clamped away.  
If it is placed outside the clamped container, the native clamp does not know how much last-line space the after content requires.

Therefore:

```text
Exclude after from multiline native mode.
```

### 3.8 Multiline native mode must remain conservative

Do not use multiline native mode for:

```text
custom ellipsis
word boundary
middle clamping
start clamping
maxHeight
expanded state
after slot
unsupported browsers
```

These should continue using the measured JS path.

### 3.9 Native clamped state detection

Single-line native mode can keep using:

```ts
scrollWidth > clientWidth;
```

Multiline native mode probably needs:

```ts
scrollHeight > clientHeight + epsilon;
```

This should be validated across browsers, fractional pixels, font loading states, and legacy `-webkit-line-clamp` behavior.

If clamped state detection is unreliable, the implementation should fall back to measured JS clamping.

---

## 4. Plain Text Measured Path Optimizations

The current measured text path is already well structured. 1.4+ should focus on reducing hot-path overhead.

### 4.1 Avoid the final redundant layout read

In the current flow, after the best fitting candidate is found, the implementation may still call the fit predicate again to ensure the DOM is left in the final candidate state.

This can be optimized by separating candidate application from candidate testing:

```ts
function applyCandidate(text: string): void;

function testCandidate(text: string): boolean;
```

During search:

```text
apply candidate
read layout
record whether it fits
```

After search:

```text
if the current DOM is not the best candidate:
  apply the best candidate without another layout read
```

Benefit:

```text
One fewer forced layout read per clamp in common cases.
```

This is small per instance but meaningful across many instances or resize storms.

### 4.2 Reduce allocations in line counting

If line counting currently derives line identity from string keys such as:

```ts
`${rect.top}/${rect.bottom}`;
```

then each probe allocates temporary strings.

A lower-allocation approach would store numeric line boxes:

```ts
type LineBox = {
  top: number;
  bottom: number;
};
```

and compare with a small tolerance:

```ts
function sameLine(a: LineBox, b: LineBox): boolean {
  return Math.abs(a.top - b.top) <= 0.5 && Math.abs(a.bottom - b.bottom) <= 0.5;
}
```

Since line limits are usually small, a tiny array and linear comparison can be faster and lower overhead than string keys.

### 4.3 Reduce memory in word boundary preparation

`boundary="word"` needs to avoid cutting inside grapheme clusters. A straightforward implementation may create both word offsets and grapheme fallback offsets, then use a `Set` to check boundary safety.

Possible improvements:

```text
Skip the Set for ASCII-safe text.
Use two-pointer comparison for sorted offset arrays.
Lazily build grapheme fallback offsets only when needed.
```

The goal is to reduce memory spikes for:

```text
long text
CJK text
emoji-heavy text
mixed language text
word boundary mode
```

This should not change behavior.

---

## 5. RichLineClamp Improvements

`RichLineClamp` is already the heaviest primitive. 1.4+ improvements should prioritize observability, caching, and correctness-preserving speedups.

### 5.1 Keep structural clamping as the model

Do not regress to string-based HTML truncation. Rich clamping should continue to operate on prepared structure and real DOM measurement.

The current model is appropriate:

```text
parse trusted inline HTML
prepare structural tree
measure candidates in connected probe
patch structural decision into visible DOM
fallback safely when layout is unsupported
```

### 5.2 Add dev diagnostics for unsupported rich content

When rich clamping falls back because markup or layout is unsupported, users should be able to understand why.

In development mode, provide diagnostic information for cases such as:

```text
out-of-flow descendants
non-inline wrappers
float
positioned content
unstable image dimensions
unsupported atomic elements
unexpected block formatting context
```

This could be exposed as:

```text
dev warning
debug callback
internal diagnostic event
```

The default production behavior should remain quiet and safe.

### 5.3 Consider bounded preparation caching

Repeated identical HTML can appear in lists, previews, and shared content blocks.

A bounded LRU cache for prepared rich text could help:

```text
key: html + boundary
value: immutable prepared rich structure
```

Requirements:

```text
Do not cache mutable DOM nodes.
Do not share mutable clamp state.
Put a strict size limit on the cache.
Benchmark memory impact.
```

### 5.4 Expand rich benchmarks

Rich benchmarks should include:

```text
shallow inline markup
deeply nested inline markup
many small text runs
one long text run
inline image
svg
custom element
unsupported markup fallback
font loading
repeated identical HTML
```

Metrics should include:

```text
duration
layout reads
client rect reads
bounding rect reads
clone count
patch count
replaceChildren count
fallback count
```

---

## 6. WrapClamp Improvements

`WrapClamp` should preserve arbitrary item and after rendering. The next optimization should improve convergence without weakening correctness.

### 6.1 Preserve `hiddenItems`

Keep the existing slot DX:

```vue
<template #after="{ hiddenItems }">+{{ hiddenItems.length }}</template>
```

Do not replace it with a lower-level API.

### 6.2 Do not assume stable after content

The `after` slot commonly depends on hidden item count:

```text
+9
+10
+99
+100
```

The width changes exactly when the visible count changes.

Since `after` is arbitrary Vue output, it may be:

```text
text
button
popover trigger
localized label
icon plus count
custom component tree
```

Therefore, do not require or assume stable after width.

### 6.3 Avoid binary search as the default grow algorithm

Binary search requires a mostly monotonic fit predicate. With arbitrary after content, the predicate may not be reliable enough.

Example:

```text
visible count changes
hiddenItems changes
after slot output changes
after width changes
line wrapping changes
```

This makes default binary search risky.

### 6.4 Add capacity hints for grow cases

The current linear grow behavior is correct but can be slow when the container becomes much wider.

A safer optimization is to use a capacity hint:

```text
1. Detect a grow case.
2. Estimate a candidate visible count from historical measurements.
3. Jump to that candidate.
4. Measure with the existing exact DOM logic.
5. If it does not fit, shrink.
6. If it fits, do local linear growth to settle exactly.
```

Possible hint inputs:

```text
previous container width
new container width
previous visible count
average measured item width
previous row capacity
previous after width
total item count
```

The key rule:

```text
The hint only improves the starting point.
The final answer still comes from actual DOM measurement.
```

### 6.5 Trigger capacity hints selectively

Do not use this path for every update.

Good triggers:

```text
container width increased significantly
total item count is large
visible count is far from total count
previous linear growth required many probes
```

Small lists and small resizes can stay on the current warm path.

### 6.6 Optional hiddenItems slice memoization

Keep returning `hiddenItems`, but internally memoize:

```text
items reference
rendered visible count
hiddenItems slice
```

Only recompute the slice when either the items array reference or visible count changes.

This is a minor optimization and should only be added if benchmark data shows value.

### 6.7 Wrap benchmarks

Add cases for:

```text
20 items
100 items
1000 items
variable item widths
before slot
after = +N
after digit boundary: +9 to +10, +99 to +100
container grow
container shrink
font loading
after as component
```

---

## 7. SSR Direction

SSR is an important 1.4+ area because the current primitives depend on client-side measurement.

The recommended default is not native CSS approximation. The recommended default is DOM-preserving visual skeleton.

### 7.1 Why not default to native CSS fallback

Native CSS fallback is not generally equivalent to `vue-clamp` semantics.

It cannot faithfully represent:

```text
before and after participation
custom ellipsis
middle or start clamping
word boundary
rich inline structure
WrapClamp after slot
```

Showing an approximate result during SSR and replacing it after hydration can produce visible jumps.

For this library, a neutral pending state is often better than a wrong clamp.

### 7.2 DOM-preserving visual skeleton

SSR should output full content in the DOM while rendering a skeleton visually when scripting is enabled.

Desired behavior:

```text
SSR DOM:
  full original content

JS enabled visual state:
  skeleton

JS disabled visual state:
  full content

After hydration and measurement:
  exact clamped result
```

This preserves:

```text
SEO
no-JS content
copyability when fallback is visible
semantic HTML
progressive enhancement
```

### 7.3 Pending state should exist on both server and initial client render

To avoid hydration mismatch:

```text
server render:
  pending = true

client hydration initial render:
  pending = true

mounted:
  measure
  pending = false
  render exact result
```

Do not rely on hydration mismatch suppression as the main mechanism.

### 7.4 Skeleton CSS

A possible model:

```css
.vc__skeleton {
  display: none;
}

@media (scripting: enabled) {
  .vc--ssr-pending {
    position: relative;
    overflow: clip;
    block-size: var(--vc-ssr-block-size);
  }

  .vc--ssr-pending > .vc__content {
    opacity: 0;
    pointer-events: none;
    user-select: none;
  }

  .vc--ssr-pending > .vc__skeleton {
    display: block;
    position: absolute;
    inset: 0;
  }
}
```

Do not use:

```css
display: none;
```

for the real content, since the point is to preserve the full DOM.

### 7.5 Component-specific SSR behavior

#### LineClamp

```text
SSR:
  full text and slots in DOM
  N-line skeleton visually

Hydration:
  exact text clamp
```

#### InlineClamp

```text
SSR:
  full inline content in DOM
  single-line skeleton visually

Hydration:
  exact inline clamp
```

#### RichLineClamp

```text
SSR:
  full trusted inline HTML in DOM
  multiline skeleton visually

Hydration:
  exact rich structural clamp
```

#### WrapClamp

```text
SSR:
  full before/items/after DOM
  wrapped skeleton visually

Hydration:
  exact visible items and exact after slot
```

### 7.6 Native exact SSR subset

Native CSS can still be used during SSR when it is semantically exact.

Examples:

```text
LineClamp maxLines = 1 with default end ellipsis and grapheme boundary.
LineClamp maxLines > 1 with no after, default end ellipsis, grapheme boundary, and supported line-clamp.
```

But this should be an exact subset, not a general fallback.

### 7.7 Early runtime is an optional enhancement, not the default

A `react-wrap-balancer` style early runtime is possible in principle, but it should not be the default path for `vue-clamp`.

The runtime is heavier, and many `vue-clamp` cases modify text, DOM structure, or slots.

If explored later, limit it to:

```text
simple LineClamp
global runtime injected once
tiny per-component trampoline
result handoff to client state
```

Avoid:

```text
full clamping runtime inline per component
RichLineClamp pre-hydration exact by default
WrapClamp pre-hydration exact by default
```

---

## 8. Benchmarking as a Versioned Asset

1.4+ should make benchmark data part of the release process.

### 8.1 Suggested structure

```text
benchmarks/
  scenarios/
    line.json
    inline.json
    rich.json
    wrap.json
    ssr.json

  results/
    1.3.0/
      chromium.json
      webkit.json
      firefox.json

    1.4.0/
      chromium.json
      webkit.json
      firefox.json

  perf.md
```

### 8.2 Metrics

Record:

```text
duration p50
duration p95
fit calls
layout reads
client rect reads
bounding rect reads
DOM writes
Vue updates
nextTick count
memory estimate
clamped state correctness
fallback count
```

SSR metrics:

```text
pending duration
hydration mismatch count
skeleton to exact transition time
visual layout delta
no-JS fallback behavior
```

### 8.3 Regression policy

Browser benchmarks are noisy. Avoid failing CI on tiny absolute differences.

Use a dual threshold:

```text
relative regression > 15% or 20%
and
absolute regression > a minimum ms threshold
```

For example:

```text
Fail only if p95 is more than 20% slower and at least 1ms slower.
```

### 8.4 Important benchmark scenarios

#### LineClamp

```text
single-line native
single-line before
single-line after
single-line before + after
multiline native no slots
multiline native before only
multiline measured after
custom ellipsis
middle clamp
word boundary
CJK
emoji ZWJ
long URL
long unbreakable token
font loading
resize storm
```

#### InlineClamp

```text
short inline text
long inline text
before/body/after
custom ellipsis
RTL
container shrink
container grow
```

#### RichLineClamp

```text
shallow markup
deep nested markup
many text runs
one long text run
inline image
svg
custom element
unsupported markup fallback
repeated identical HTML
```

#### WrapClamp

```text
20 items
100 items
1000 items
variable widths
before slot
after text
after component
+9 to +10
+99 to +100
container grow
container shrink
```

#### SSR

```text
LineClamp skeleton
InlineClamp skeleton
RichLineClamp skeleton
WrapClamp skeleton
native exact subset
hydration transition
no-JS fallback
```

---

## 9. Pretext as a Future Accelerator

Pretext is promising, but it should not replace DOM truth.

### 9.1 Role

Pretext should act as:

```text
predictor
accelerator
candidate generator
```

not as:

```text
final authority
```

The future model should be:

```text
Pretext predicts a cut point.
DOM verifies the candidate.
If verification passes, use it.
If verification fails, fall back to current measured search.
```

### 9.2 First phase: experimental entry

Do not put Pretext into the default path immediately.

Possible entry points:

```ts
import { LineClamp } from "vue-clamp/pretext";
```

or:

```ts
import { LineClamp } from "@vue-clamp/pretext";
```

Goals:

```text
collect accuracy data
measure prepare cost
compare against current measured path
find unsupported CSS text cases
understand simple case overhead
```

### 9.3 Second phase: internal accelerator

If proven reliable, Pretext can become an internal accelerator for plain text `LineClamp`.

Candidate conditions:

```text
plain text
not rich
not native exact subset
text is long enough
computed font is available
line-height is modelable
letter-spacing is modelable
repeated resize occurred
```

Avoid Pretext for:

```text
short text
obvious native single-line path
native multiline exact subset
complex slots
rich content
unmodeled CSS text behavior
```

### 9.4 Why simple cases may not matter as much

If Pretext is slightly slower for simple cases, it may not affect perceived performance. But the default path should still avoid unnecessary preparation work when the current path is already cheap or native CSS can solve the case.

Use thresholds rather than always-on behavior.

---

## 10. Smaller Correctness-Preserving Optimizations

These are lower priority than native expansion, SSR, and benchmarks, but they are worth tracking.

### 10.1 Candidate application without retesting

Avoid final redundant layout reads by separating:

```text
apply candidate
test candidate
```

### 10.2 Lower-allocation line counting

Replace string-based line keys with numeric rect comparison.

### 10.3 Lower-memory word boundaries

Avoid unnecessary `Set` allocation and lazily build fallback grapheme offsets where possible.

### 10.4 hiddenItems slice memoization

Keep public `hiddenItems`, but memoize internal slices when safe.

---

## 11. Non-goals for 1.4+

The following should not be part of the 1.4+ direction unless future evidence strongly changes the tradeoff.

```text
No public strategy prop.
No locale prop.
No replacement of hiddenItems with hiddenCount or getter.
No assumption that WrapClamp after content is stable.
No default binary search for arbitrary WrapClamp after content.
No default native CSS approximation for SSR.
No full clamping runtime inline per component.
No default pre-hydration exact RichLineClamp.
No default pre-hydration exact WrapClamp.
No Pretext as a replacement for DOM verification.
```

---

## 12. Suggested Roadmap

### 1.4.0

Focus on the highest-confidence internal improvements.

```text
Expand LineClamp native mode:
  maxLines = 1 uses text-overflow.
  maxLines > 1 can use line-clamp when after is absent.
  before is allowed in both modes.

Introduce SSR DOM-preserving skeleton:
  server pending state
  client initial pending state
  mounted exact measurement
  CSS variable based skeleton styling

Start benchmark versioning:
  line benchmark
  native vs measured benchmark
  wrap after-width benchmark
  SSR skeleton benchmark
```

### 1.4.x

Focus on correctness and performance refinement.

```text
Improve multiline native clamped-state detection.
Add RichLineClamp dev diagnostics.
Add WrapClamp capacity hints.
Add benchmark regression thresholds.
Add low-allocation layout measurement improvements.
```

### 1.5+

Explore larger accelerators after benchmark infrastructure exists.

```text
Pretext experimental package or subpath.
Prepared rich text bounded cache.
More SSR integration helpers.
Optional simple LineClamp early runtime experiment.
```

---

## 13. Summary

The 1.4+ direction should build directly on the current 1.3.0 implementation:

```text
LineClamp:
  expand exact native fast paths.

Text measured path:
  reduce unnecessary layout reads and allocations.

RichLineClamp:
  improve diagnostics, caching, and benchmark coverage.

WrapClamp:
  preserve arbitrary after content and hiddenItems DX,
  but improve grow convergence with capacity hints.

SSR:
  prefer DOM-preserving visual skeleton over incorrect native approximation.

Benchmarking:
  make performance data versioned and release visible.

Pretext:
  explore as a predictor and accelerator,
  never as an unverified replacement for browser layout.
```

The library should continue to prioritize exact behavior, but become more aggressive internally when it can prove that a faster path is equivalent.
