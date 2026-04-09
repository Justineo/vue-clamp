# Clean Room Research Report: Adding Inline Rich Text Clamping to `vue-clamp`

> Update on 2026-04-08:
> The shipped `RichLineClamp` implementation kept the explicit special handling for `br`, `wbr`,
> atomic `img`, and outer `svg`, but generalized wrapper support from a fixed wrapper tag list to a
> behavior-based rule: reconstructable light DOM plus computed inline layout.

## Executive Summary

This report evaluates the feasibility of adding rich text truncation support to `vue-clamp`, with scope intentionally limited to inline layout content plus a small set of atomic elements such as `img` and outer `svg`. The conclusion is positive: this feature is technically feasible, fits the existing public API shape well, and can be implemented without turning `LineClamp` into a general DOM or VNode truncator. The safest product direction is to add an `html` prop as a second source mode for `LineClamp`, keep the rest of the component contract largely unchanged, and constrain the first release to end truncation only. [S1][S2][S5]

The key architectural insight is that the problem becomes manageable once it is framed as truncating an inline formatting stream rather than arbitrary HTML. In this narrower model, text runs can still use grapheme-aware boundaries, while atomic nodes such as `img` and outer `svg` can be treated as indivisible units. Measurement can stay browser-driven, using actual layout rather than string heuristics, which is consistent with the current design of `vue-clamp`. [S2][S3][S6][S7][S9]

The main recommendation is therefore:

- Keep `LineClamp` as the public component.
- Add `html?: string` as a source alternative to `text?: string`.
- For `html` mode in v1, support only `location="end"`.
- Accept only inline layout content plus a small, explicit atomic subset.
- Do not support source slots for rich content.
- Treat sanitization as the caller's responsibility, not the component's. [S2][S5][S8]

## 1. Current Project Context

The current project shape already points toward specialized primitives rather than one universal clamp abstraction. The package README presents three separate components: `LineClamp` for multiline text, `InlineClamp` for single-line strings, and `WrapClamp` for wrapped items. The repository also shows a fresh `v1.0.0` release on April 4, 2026. [S1]

`LineClamp` is currently built around a plain string source model. Its public props include `text`, `maxLines`, `maxHeight`, `ellipsis`, `location`, and `expanded`. Internally it computes a normalized location ratio, prepares the source string into grapheme boundaries, and then uses measured layout to binary-search for the largest kept portion that still fits. There is also a narrow native fast path for a very specific case: single-line end truncation with the default ellipsis character and no `maxHeight`. [S2][S3]

That design has two important implications:

1. The current implementation is not merely missing HTML support by accident. Its main data model is explicitly a single text string. [S2]
2. The parts that are most worth preserving are not the exact string-only implementation details, but the current user-facing contract and the measured, browser-driven approach to deciding what fits. [S2]

There is also clear evidence that HTML support is a real and recurring user request. Public issues include requests such as "Implement v-clamp with v-html", "Not possible to use html in v-clamp", and "Doesn't work with v-html", spanning from 2019 through 2021 and still visible in the issue tracker today. [S5]

## 2. Problem Framing

The feature under consideration should not be described as "support arbitrary HTML". That framing makes the problem much larger than it needs to be.

The practical target is narrower:

- A source string of sanitized HTML.
- Content that actually participates in inline layout.
- A limited set of atomic, indivisible inline elements.
- Measured multiline truncation, preserving valid markup.
- No source-time Vue interactivity inside the clamped body. [S6][S7][S8]

This scope is well aligned with the browser's own layout model. MDN defines inline-level content as content that participates in inline layout, and notes that most text sequences and replaced elements are inline-level by default. `img` is a standard replaced element and is therefore a natural atomic candidate. `svg` is not a replaced element in the same way, but treating the outer `svg` node as an atomic inline object is a pragmatic product decision for icon-like content. [S6][S7]

Once stated that way, the design problem becomes:

> Given a sanitized inline HTML fragment and a line or height budget, determine the longest valid prefix of the inline content stream that fits, then append an ellipsis while preserving valid markup and current layout semantics.

That is a tractable problem.

## 3. Recommended Product Surface

### 3.1 Public API

The cleanest public API is to keep `LineClamp` and extend its source model:

- `text?: string`
- `html?: string`

These two props should be mutually exclusive. If both are passed, development mode should warn and `html` should win. The rest of the existing contract should remain as consistent as possible:

- `maxLines`
- `maxHeight`
- `ellipsis`
- `expanded`
- `clampchange`
- `v-model:expanded`
- `before` and `after` slots [S2]

This gives users a predictable migration path and preserves the current mental model. The user still reaches for `LineClamp` when the job is "clamp a multiline body", regardless of whether the source is plain text or sanitized inline markup. [S1][S2]

### 3.2 Location Support

For `text`, keep the current behavior.

For `html`, support only end truncation in the first version. Any other `location` value should warn in development and behave as `end`.

This is a major but justified constraint. End truncation only requires preserving a prefix and closing ancestor elements correctly. Start and middle truncation require constructing a suffix subtree as well, which makes the markup reconstruction problem substantially more complex. The current string-based `location` model also depends on splitting a single text stream into prefix and suffix by ratio, which does not translate cleanly to nested markup. [S2][S3]

### 3.3 Source Slots

Rich source content should not be accepted through the default slot.

This is one of the most important design decisions. If source content is allowed through slots, users will naturally put component trees, event handlers, directives, refs, and other Vue-level behavior into the clamped subtree. At that point the problem stops being "truncate rich text" and becomes "truncate a possibly interactive VNode graph while preserving semantics", which is a different class of feature entirely.

By accepting only `html`, the source contract stays static and serializable. That is far easier to reason about, sanitize, validate, measure, reconstruct, and test. The existing `before` and `after` slots can stay because they sit outside the clamped source body and already fit the current component model. [S2][S8][S10]

## 4. Supported Content Model

### 4.1 Supported in v1

The initial supported content model should be explicit and narrow:

- Text nodes
- Common inline formatting elements such as `span`, `a`, `strong`, `em`, `b`, `i`, `u`, `s`, `small`, `mark`, `code`, `abbr`, `cite`, `q`, `kbd`, `samp`, `var`, `sub`, `sup`, `time`
- `br`
- `wbr`
- Atomic `img`
- Atomic outer `svg`

### 4.2 Not Supported in v1

The following should be out of scope:

- Block descendants such as `div`, `p`, `ul`, `table`
- Interactive controls such as `button`, `input`, `textarea`, `select`
- Media and embedded browsing contexts such as `video`, `iframe`
- Custom elements or Vue components
- Generic arbitrary `inline-block`, `inline-flex`, or style-driven layout containers
- Contenteditable subtrees
- Slot-based source content

### 4.3 Why the Atomic Set Should Stay Small

It is tempting to define "atomic" as any element whose computed style happens to behave like an indivisible inline box. That is possible in theory but introduces a major dependency on computed style and live layout in the preparation phase.

A simpler first release is tag-based and explicit:

- `img` is atomic because it is a classic replaced element and is naturally indivisible. [S7]
- Outer `svg` is atomic because that fits common inline icon usage and avoids having to interpret its internal tree. [S6]

This choice is conservative, but it keeps the first implementation understandable and predictable.

## 5. Core Design Principle

The implementation should not attempt to "truncate HTML strings". It should instead operate on an internal representation of the inline content stream.

That representation should preserve enough structure to rebuild valid markup, while flattening the problem enough that search and measurement stay simple.

A useful internal model looks like this conceptually:

- Element wrappers
- Text runs with grapheme boundaries
- Atomic nodes
- Explicit line break nodes

From there, truncation becomes a search over "how many units of the prefix can be kept", where:

- One grapheme cluster inside a text node counts as one unit.
- One atomic node counts as one unit.
- One `br` counts as one unit.
- One `wbr` counts as one unit.

The current project already has a valuable building block here: the public text path uses `Intl.Segmenter` for grapheme segmentation and stores text boundary offsets. That should be reused for text runs inside rich content rather than reimplemented. [S3]

## 6. Proposed Internal Architecture

### 6.1 Shared Shell, Separate Engines

`LineClamp` should be refactored conceptually into:

- A shared shell for state, slots, expansion, emitted events, and layout observation.
- A text engine for the current string path.
- An HTML engine for the new rich content path. [S2]

This is preferable to trying to bolt HTML support directly into the current text-only algorithm. The user-facing shell stays stable, while each engine can optimize for its own source model.

### 6.2 Preparation Phase

When `html` changes:

1. Parse the HTML into a detached document with `DOMParser.parseFromString(html, "text/html")`.
2. Walk the parsed tree.
3. Validate tags against the supported subset.
4. Convert the tree into a prepared internal representation.
5. For text nodes, precompute grapheme boundaries using the same principle as the current text path. [S3][S8]

Using `DOMParser` is appropriate for building a detached source DOM, but it must not be misinterpreted as a security layer. MDN notes that the parsed document is inert while detached, but scripts and handlers can still run if nodes are later inserted into the visible DOM. [S8]

### 6.3 Live Validation Phase

Structural parsing alone is not enough because inline and block behavior is ultimately a layout property, not just a tag property. MDN explicitly frames inline-level content as a CSS layout concept. [S6]

Therefore the implementation should perform one live validation pass after initial render, using computed style on the rendered clamped body:

- Allowed wrapper displays: `inline`, possibly `contents`
- Allowed atomic displays for supported atomic tags: `inline`, and possibly `inline-block` only for those atomic tags
- Reject `block`, `flex`, `grid`, `list-item`, `table`, and similar layout modes
- Reject `position: absolute`, `fixed`, `sticky`
- Reject floated descendants

If validation fails, the component should not attempt best-effort clamping. It should render the original HTML and report `clamped = false`, while warning in development mode.

This fallback strategy matters. When a rich text feature cannot preserve semantics confidently, "show full content" is safer than "silently drop or distort content."

## 7. Measurement Strategy

### 7.1 Use Real Browser Layout

The current `LineClamp` implementation already relies on actual browser layout and `getClientRects()`-style geometry instead of trying to derive fit from string length. That is the correct foundation for rich content too. [S2][S9]

For `html` mode, fitting should continue to be layout-driven:

- Render a candidate prefix plus ellipsis.
- Measure the visible content region.
- Determine whether it fits within `maxLines` and or `maxHeight`.
- Binary-search the largest kept prefix that still fits. [S2][S9]

### 7.2 Why `Range` Is the Right Primitive

`Range.getClientRects()` is especially useful here because MDN notes that it aggregates the rectangles of all elements in the range. That means a range covering a mixture of text, inline wrappers, and atomic elements can still be measured as one layout-aware unit. [S9]

There are two sensible ways to use `Range`:

1. Use it mainly for measurement while rebuilding truncated DOM through a custom materializer.
2. Use it both for measurement and for fragment extraction through `cloneContents()`.

The better choice for a first implementation is option 1. `Range` should be the measurement primitive, but truncated DOM should be built by a custom materializer. That yields tighter control over where ellipsis lands, how atomic nodes are handled, and how unsupported edge cases are rejected.

## 8. Materialization Strategy

### 8.1 Recommended Approach

A custom recursive materializer is preferable to relying entirely on `Range.cloneContents()`.

MDN notes that `Range.cloneContents()` clones selected children into a fragment, but cloned content keeps HTML attribute event handlers and duplicated `id` values, while listeners added via DOM events are not copied. Those semantics are exactly the kind of ambiguity this feature should avoid leaning on. [S10]

A custom materializer can do something simpler and cleaner:

- Shallow-clone supported inline wrapper elements.
- Copy text nodes only up to the chosen grapheme boundary.
- Copy atomic nodes whole or not at all.
- Insert ellipsis at the exact truncation point.
- Close markup naturally through recursive reconstruction.

### 8.2 Ellipsis Placement

Ellipsis should remain a plain string, not HTML.

Placement rule:

- If truncation occurs inside a text run nested in inline wrappers, the ellipsis should become the last child within that same deepest wrapper.
- If truncation occurs immediately before an atomic node, the ellipsis should be inserted in the current parent container.
- If truncation occurs after a wrapper has already received some of its children, the ellipsis stays inside that wrapper.

This gives natural visual results. For example, if truncation lands inside a `strong` node, the ellipsis inherits that styling. If truncation lands inside an `a`, the ellipsis becomes part of the link. That is consistent with treating the ellipsis as part of the visible content stream rather than as an external decoration.

### 8.3 Why Not Use HTML Ellipsis Content

The current component accepts a string `ellipsis`, and rich mode should preserve that contract. Allowing HTML ellipsis fragments would create a second, unbounded source of rich content inside the clamped body and would complicate both security and layout behavior for limited product value. [S2][S8]

## 9. Text Boundary Strategy

Text inside rich content should not be split by UTF-16 code units or naive code points. The current text path already uses `Intl.Segmenter` with grapheme granularity and stores `boundaryOffsets`, with an ASCII-safe fast path. That is exactly the right behavior to keep for text runs inside HTML mode. [S3]

This gives several benefits:

- Emoji and combined glyphs stay intact.
- Regional indicators and diacritics are less likely to be corrupted.
- Text truncation quality stays aligned between `text` mode and `html` mode.

In other words, the rich text implementation should reuse the current grapheme model rather than invent a second truncation notion for text nodes.

## 10. Whitespace and Line Break Semantics

This area deserves restraint.

### 10.1 Avoid Aggressive Trimming in v1

The current plain text path trims visible prefix and suffix fragments when constructing truncated strings. That is appropriate for a single text source, but richer DOM makes whitespace semantics more context-dependent. [S3]

In HTML mode, whitespace behavior depends on:

- Collapsing rules
- DOM boundaries
- Author intent
- CSS `white-space`
- Explicit `br` and `wbr`

Therefore the first version should not try to aggressively normalize or trim rich content around the truncation point.

A conservative policy is better:

- Preserve author whitespace as rendered by the browser.
- Optionally drop trailing empty text nodes after reconstruction.
- Optionally drop trailing consecutive `wbr` nodes if they end up directly before ellipsis.

This may occasionally leave a visible space before the ellipsis, but it is safer than guessing wrong.

### 10.2 `br`

`br` should be supported and treated as an atomic unit. If truncation occurs after a `br`, the ellipsis may begin on the next line. That is not always visually ideal, but it respects explicit author line breaks and is much more predictable than trying to auto-rewrite them.

### 10.3 `wbr`

`wbr` should also be supported as a lightweight atomic unit. It may or may not affect the actual chosen break depending on layout. If it falls at the very end of the reconstructed prefix, it is reasonable to omit it.

## 11. Observation and Recompute Model

The current `LineClamp` watches props, uses `ResizeObserver`, and also recomputes after font loading via `document.fonts`. `WrapClamp` adds a more sophisticated queued recompute model with pending and running recomputation flags plus a settled layout signature. [S2][S4]

For rich mode, the observation layer should become slightly more robust than the current plain text path because atomic nodes introduce more layout volatility:

- Observe root, content, before slot container, after slot container, and body.
- Recompute when fonts finish loading.
- Recompute when visible `img` nodes fire `load` or `error`.
- Recompute when the component becomes measurable after being initially hidden.
- Use a queued recomputation strategy similar to the one visible in `WrapClamp`, so that slot-dependent layout can settle across more than one pass. [S2][S4]

This matters in real usage because the visible presence of `after` content may itself depend on `clamped`, which can change layout and require a second pass.

## 12. Fallback and Error Policy

The fallback policy should be intentionally strict and easy to explain.

If any of the following is true:

- Unsupported element encountered
- Unsupported computed layout encountered
- Root width is zero or layout is otherwise not measurable
- Reconstruction cannot preserve supported semantics confidently

Then the component should:

- Render the original HTML unchanged
- Set `clamped = false`
- Emit normal state updates
- Warn only in development mode

What it should not do:

- Silently strip unsupported nodes
- Auto-convert unsupported rich content to plain text
- Partially clamp some descendants while ignoring others

The reason is simple: once a component accepts rich text, preservation of meaning matters more than approximate truncation.

## 13. Security Model

The security contract must be explicit:

> `html` mode accepts sanitized or otherwise trusted HTML only.

This is non-negotiable. `DOMParser.parseFromString()` does not make inserted DOM safe. MDN states that the parsed document is inert while detached, but event handlers and scripts can run if inserted into the visible DOM. [S8]

Therefore:

- The component must not advertise sanitization.
- Documentation should say the caller owns sanitization.
- `ellipsis` remains text only.
- Source slots stay unsupported.
- Internal cloning and reconstruction should preserve only supported nodes and attributes as-is, under the assumption that the input is already safe.

This keeps the trust boundary clear.

## 14. Accessibility

The current plain text path compensates for truncation by rendering a visually hidden copy of the full source text and marking the visible truncated text as `aria-hidden` when necessary. That pattern is reasonable for plain text but becomes risky for rich HTML because it can duplicate semantics, duplicate IDs, and create inconsistent link or image representations. [S2][S10]

For rich mode v1, the safer accessibility contract is:

- Render only one DOM representation of the clamped content.
- Do not clone the full rich source into a hidden accessibility-only tree.
- Let expanded mode be the path to the full content.
- Preserve normal semantics of visible inline elements such as links and images.

This is more conservative than the plain text strategy, but it avoids introducing a second semi-semantic DOM that would be difficult to reason about.

## 15. SSR and Hydration

The most practical SSR strategy is to render the original HTML on the first pass, then clamp on mount.

This matches the nature of the problem: truncation depends on actual layout, available width, loaded fonts, and image dimensions, all of which are client-side concerns. The current plain text path already behaves in a way that is compatible with deferred layout-driven recomputation after mount. [S2]

Implications:

- SSR output remains stable and complete.
- Hydration does not need to guess a truncation boundary.
- Post-mount recomputation updates the DOM once actual layout is known.

The tradeoff is that users may briefly see the unclamped content before the first client-side measurement. That is acceptable for a layout-dependent feature and preferable to hydration mismatch.

## 16. Performance Considerations

The primary cost drivers are:

- HTML parsing on source change
- Internal tree preparation
- Repeated candidate materialization during binary search
- Layout reads during fit checks
- Recompute on image and font loads

That is still manageable because:

- Preparation only happens when `html` changes.
- Search complexity is logarithmic in the number of units.
- Text runs reuse precomputed grapheme boundaries.
- Atomic nodes reduce search granularity for non-text content.
- The supported subset is intentionally narrow.

Important optimization guidelines:

- Cache the prepared tree until `html` changes.
- Cache per-text-run boundary offsets.
- Reuse a measurement `Range` where possible.
- Batch DOM writes and reads inside recompute.
- Avoid recompute storms by using a queued request model. [S3][S4][S9]

## 17. Alternative Approaches and Why They Are Weaker

### 17.1 CSS `line-clamp` Only

A CSS-only fallback is attractive for simplicity, but MDN labels `line-clamp` as limited availability, and the browser behavior does not align well with the current `vue-clamp` contract. It also does not solve markup-aware ellipsis placement or broader API consistency with `maxHeight`, expansion, and slot-influenced layout. [S11]

### 17.2 Accept Arbitrary Source Slots

This fails the complexity test. It invites interactivity, component subtrees, VNode identity concerns, and event semantics that are unrelated to the core truncation problem.

### 17.3 Convert HTML to Plain Text First

This gives up the main value of the feature, which is preserving inline formatting and atomic visual elements.

### 17.4 Truncate Raw HTML Strings with String Heuristics

This is fragile and not layout-aware. It cannot know what actually fits in a given width and font context, which is precisely the class of problem `vue-clamp` already solves by measuring rendered output. [S2][S9]

## 18. Recommended Incremental Rollout

A staged delivery path reduces risk.

### Phase 1

Refactor `LineClamp` internally into a shared shell plus source-specific engines, and strengthen the recompute pipeline using lessons from `WrapClamp`. No new public behavior yet. [S2][S4]

### Phase 2

Add `html` mode with:

- end truncation only
- inline subset only
- atomic `img` and outer `svg`
- raw render fallback on unsupported content
- caller-owned sanitization [S6][S7][S8]

### Phase 3

Evaluate real-world feedback before considering:

- broader atomic detection
- better whitespace heuristics
- start or middle truncation for rich content
- additional diagnostics and developer tooling

This is a better strategy than trying to solve all rich text cases in one release.

## 19. Final Recommendation

The feature is worth building, but only if it is framed correctly.

The best framing is not "HTML support for `LineClamp`" in the unlimited sense. The best framing is:

> Add an `html` source mode to `LineClamp` for sanitized inline rich text, with support for a small atomic subset and end truncation only.

Under that framing, the design is coherent with the current project direction, aligns with real user demand, and can reuse the most valuable parts of the existing system: measured layout decisions, grapheme-aware text boundaries, and the current expand/collapse shell. [S1][S2][S3][S5]

The most important product choices are:

1. Keep the component name and most of the API.
2. Add `html`, do not add source slots.
3. Support only inline layout content plus `img` and outer `svg`.
4. Support only end truncation in v1.
5. Reconstruct markup with a custom materializer.
6. Fail safe by rendering original HTML when unsupported content appears.
7. Treat sanitization as a caller responsibility. [S2][S5][S8]

That combination gives a realistic path to shipping rich text truncation without compromising the conceptual clarity of `vue-clamp`.
