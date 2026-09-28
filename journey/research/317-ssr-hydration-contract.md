# SSR and hydration contract research

Date: 2026-08-22

## Executive conclusion

`vue-clamp` can provide first-class SSR support across all four component families, including the
hard invariant that a collapsed component never paints content beyond its configured line or height
limit. That invariant changes the architecture: full-then-clamp, fade, and a visibly clipped
approximation are not acceptable pending states.

"Complete SSR" therefore needs two promises:

1. a universal safety baseline that preserves source content in HTML, hydrates without warnings or
   discarded DOM, works with streaming and lazy hydration, and never overpaints the active limit;
2. a parser-time eager path that measures in the actual browser and reveals an exact candidate before
   the first visible paint, similar to React Wrap Balancer.

The first promise is achievable for every component by combining native CSS or an exact height cap
where those are sufficient with `visibility: hidden` for layouts whose row count cannot yet be
proved. The second is realistic for plain `LineClamp`, measured `InlineClamp`, and `WrapClamp`
without result-dependent affixes. It cannot be semantically complete for arbitrary Vue slots or the
current measured `RichLineClamp` without either keeping the component hidden until Vue settles or
introducing a narrower SSR-stable contract.

Exact truncation cannot be computed by an ordinary SSR process. The answer depends on the client's
actual container width, loaded fonts, browser line breaking, inherited CSS, zoom, writing direction,
and rendered slot geometry. A headless browser on the server would still model the server's viewport
and fonts rather than the eventual client, while making streaming, CDN caching, and edge rendering
substantially worse.

`react-wrap-balancer` does not solve that impossibility on the server. It sends the source content and
an adjacent classic inline script. The browser parser executes that script synchronously after the
wrapper is parsed, performs a width search, writes one `max-width` style, and installs a
`ResizeObserver`. Its
`Provider` shares the function body, `useId` supplies a hydration-stable identifier, and `nonce`
supports request-scoped CSP. This is a useful pre-hydration architecture, not server-side layout.

## What "complete" should mean

The SSR contract should be evaluated on separate axes rather than by a single supported/unsupported
label:

| Axis                     | Required contract                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Universal execution      | Importing and rendering never requires DOM globals on the server.                                            |
| Source HTML              | Full text, rich HTML, or item content is present in server HTML for indexing and recovery.                   |
| Hydration                | Server DOM and the first client VNode agree; no mismatch suppression is needed as normal control flow.       |
| First paint              | A collapsed component never paints beyond its limit; supported eager subsets reveal only an exact result.    |
| State                    | `clamped`, `hiddenItems`, controls, events, and slots distinguish unknown pending state from measured false. |
| No JavaScript            | Source remains in HTML and accessible where possible, but the visible fallback stays hard-contained.         |
| Streaming/lazy hydration | Output stays valid if the component chunk arrives before the application hydrates.                           |
| CSP                      | Core SSR works without inline script; eager enhancement supports nonce and a static/hashable path.           |
| Revalidation             | Fonts, resizes, props, and slots converge without exposing an overflowing intermediate candidate.            |

The server cannot truthfully expose `clamped: true | false` for a measured layout. That state is
three-valued until browser settlement: `pending`, `fit`, or `clamped`. Treating pending as false is
convenient internally but is not a complete public SSR contract.

## Current implementation audit

### Server output

Direct `renderToString` runs against the built package succeeded for all four components. Browser
globals are kept behind guarded helpers or client lifecycle work, and the server output contains the
full source content.

The current initial states are:

| Surface                                            | Server output today                                                    | Consequence                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `LineClamp`, one-line native subset                | Full text plus `text-overflow` styles                                  | Visually exact, but `clamped` is still initially false.                    |
| `LineClamp`, measured subset                       | Full text, no line-limit visual                                        | Full content can paint before mount and then shorten.                      |
| `LineClamp`, multi-line native-eligible subset     | Server chooses measured markup because `CSS` is absent                 | Client chooses native mode and expects different styles.                   |
| `InlineClamp`, native subset                       | Full text plus `text-overflow` styles                                  | Visually exact and hydration-stable.                                       |
| `InlineClamp`, measured subset                     | Full body text                                                         | It is rewritten during mount; full text can paint first.                   |
| `RichLineClamp`, measured subset                   | Full rich DOM plus an empty hidden probe                               | Hydration is structurally stable and mount later patches the visible tree. |
| `RichLineClamp`, multi-line native-eligible subset | Server emits the measured probe; client expects native mode without it | Both style and child-count mismatches occur.                               |
| `WrapClamp`                                        | Every item and `after` with `hiddenItems: []`                          | Mount later removes items and changes result-dependent slot output.        |

`maxHeight` already gives Line/Rich/Wrap a coarse server-side clip through root `max-height` and
`overflow: hidden`, but it does not produce the requested ellipsis, boundary, location, slot state,
or exact visible candidate.

### Real hydration experiment

A Vite SSR page was rendered with `renderToString`, loaded in Chromium, and hydrated with
`createSSRApp`. DOM was captured before hydration, immediately after `app.mount`, and after two
animation frames.

Observed results:

- measured `LineClamp`, measured `InlineClamp`, and `WrapClamp` hydrated without mismatch warnings;
  their visible output still changed during mount or the next Vue commit;
- native-eligible two-line `LineClamp` reported a hydration style mismatch;
- native-eligible two-line `RichLineClamp` reported both a hydration style mismatch and an extra
  server-child mismatch because the server rendered a probe that the client native VNode omitted;
- Vue left the server's empty native content style in place. The two-line native cases therefore
  remained visually unclamped in this experiment instead of merely producing a harmless warning.

The cause is the render-time `CSS.supports` branch in `resolveNativeMode`. Vue's hydration code
describes class/style/attribute mismatches as check-only and does not rectify them as normal
hydration work. `data-allow-mismatch` only suppresses diagnostics; it does not turn a divergent
render into a sound state transition.

This is a current correctness defect and should be fixed before presenting SSR as supported.

### Minimal eager-hydration proof

A separate Vue 3.5 spike proved the core mechanism needed for a React Wrap Balancer-like enhancement:

1. the component used `useId()` to render a stable `data-*` identifier;
2. the server emitted source text followed by an inline script;
3. the parser-time script replaced the visible text and recorded the result in a `data-*` seed;
4. client `setup()` found the existing element by its stable ID and initialized the first client
   VNode from that seed;
5. hydration completed with the modified text, identical pre/post DOM, and no mismatch warning.

This proves that Vue itself is not a blocker. The hard work is designing a small, safe bootstrap
solver and a public state/slot contract, not hydrating a parser-time result.

## What React Wrap Balancer actually provides

The current source has four relevant pieces:

- `relayout` resets the wrapper width, reads its parent width and height, binary-searches the smallest
  wrapper width that preserves the original height, and writes the chosen `max-width`;
- an inline `<script>` installs the function and invokes it immediately after each wrapper so work
  can happen before hydration;
- `ResizeObserver` is also installed by the inline path so font or layout changes that occur before
  React mounts are not missed;
- `Provider` shares the function body, while per-component scripts retain the small invocation.

Modern browsers can instead use `text-wrap: balance`; the package detects it and skips the JS search
by default. Native `text-wrap: balance` is now broadly available, but browsers intentionally limit
the number of lines they balance, and native balancing changes line breaks without shrink-wrapping
the element the same way as the JS fallback.

The approach has known costs:

- it injects parser-blocking inline scripts and needs a request nonce under common CSP policies;
- its open strict-CSP/static-site issue notes that per-request nonces are not available to immutable
  static HTML and dynamic script contents are awkward to hash;
- its early-observer design was added after a reported web-font flicker window;
- the published `1.1.1` package declares React support through React 18, so it is an architectural
  reference rather than a current cross-framework compatibility standard.

Most importantly, React Wrap Balancer mutates one style on a stable wrapper. `vue-clamp` measured
paths can replace text, add accessibility siblings, patch a rich tree, remove item nodes, and rerun
arbitrary Vue slots from `clamped` or `hiddenItems`. Copying the inline-script shape without
addressing those differences would create hydration bugs rather than SSR support.

## Hard product boundaries

### The no-overpaint invariant requires a fail-closed pending state

`overflow: hidden` alone is not a line-count guarantee. Without a block-size limit it hides only
content outside the root's current box, and an SSR root containing the full source expands to fit
that source. An `Nlh` cap is a useful guard for ordinary text, but it is not an exact representation
of browser line boxes containing tall affixes, replaced elements, custom line heights, or flex rows.

The safe initial strategy is therefore partitioned by what can already be proved:

- `maxHeight` can send the exact configured `max-height` with `overflow: hidden` from the server;
- single-line Inline/native Line can send `white-space: nowrap` plus overflow containment;
- semantically eligible multi-line Line/Rich can send the specified legacy line-clamp combination
  in both server and first client VNode;
- a measured text mode can use an `lh`-based block-size guard while parser-time measurement runs,
  but it must not reveal that approximation as its final candidate;
- Wrap rows and arbitrary slot/rich geometry cannot be bounded by `maxLines * 1lh`; they must remain
  `visibility: hidden` inside a bounded placeholder until an exact result exists.

`visibility: hidden` is deliberate rather than a visual preference: the subtree still participates
in layout and can be synchronously measured, while no excess content is painted. The full source can
remain in SSR HTML for indexing and recovery without being visually exposed. If bootstrap or
hydration is blocked, correctness fails closed as hard-contained or hidden content instead of
showing too much. That is the unavoidable availability trade-off implied by the absolute invariant.

The same rule applies after hydration. A resize or font change must first put the component into a
hard-contained measuring state, run candidate work without a paint opportunity, and reveal only the
committed result. This particularly affects `WrapClamp`: some growth paths await `nextTick()` after
materializing candidate items, so the current implementation needs a measuring guard even though
individual search candidates use `display: none` correctly. Line/Inline perform their live-node
candidate writes synchronously inside one task, while Rich already searches in a hidden probe.
Rich's current unsafe-source `fallback` also needs new collapsed semantics: it may preserve the
authored DOM, but it cannot reveal the full source while an active limit exists. It must stay
hard-contained/hidden or require explicit expansion.

### Arbitrary result-dependent slots prevent universal eager exactness

Before hydration, a plain script cannot execute a Vue slot render function. Examples include:

- an `after` slot that exists only when `clamped` is true;
- a control whose label changes with `clamped`;
- a `WrapClamp` summary derived from the exact `hiddenItems` array.

The server does not know the measured result, so it cannot render the correct variant. Rendering all
variants would duplicate arbitrary DOM, IDs, custom elements, resources, and side effects. For
`WrapClamp`, there can be `items.length + 1` different hidden-item suffixes. Serializing Vue render
functions into the page is neither a viable nor a secure library contract.

An eager bootstrap can make the core text/item geometry exact, but general slots must remain pending
until Vue hydrates. Under the no-overpaint invariant that means keeping the affected component hidden,
unless the public API gains an explicit `ssrStable` contract requiring slot output and geometry to be
independent of `clamped` and `hiddenItems`. The limitation should be explicit rather than hidden
behind a boolean false.

### Rich HTML makes a tiny bootstrap unrealistic

The production Rich solver deliberately rejects unsafe connected clones, rebuilds browser style
metadata, preserves wrapper structure, and patches nested text/atomic runs. Reproducing that logic in
a parser-time script would add substantial duplicate runtime and reopen the custom-element,
document-identity, embedded-resource, and active-SVG safety boundary.

Native Rich subsets can be exact from server CSS. Non-native Rich should use the universal pending
contract until there is evidence that a separate eager payload is worth its size and security cost.

### Server prediction is only a hint

Canvas measurement, Pretext, user-agent width hints, or fixed breakpoint tables can reduce the
search space, but none represents inherited CSS and final browser line boxes completely. They may be
used later as client-verified accelerators. They must not determine server HTML or the initial
hydrated state as if they were exact.

## Option comparison

| Approach                            | Hydration                             | First paint                              | All APIs                         | Assessment                                                 |
| ----------------------------------- | ------------------------------------- | ---------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Full source, measure after mount    | Stable if render branches agree       | Violates the no-overpaint invariant      | Yes                              | Reject for an active collapsed SSR state.                  |
| Server-native CSS subsets           | Stable when mode is deterministic     | Exact from first CSS paint               | Narrow semantic subset           | Best path whenever semantics match.                        |
| Hard-contained hidden pending state | Stable DOM and measurable layout      | Never overpaints; may initially be blank | Yes                              | Required fail-closed baseline for unprovable layouts.      |
| Parser-time inline solver           | Can be stable with seed handoff       | Exact before reveal on supported shapes  | Not for arbitrary slots/rich DOM | Primary premium path, guarded by the hidden baseline.      |
| Server canvas/layout prediction     | Stable only if treated as hint        | Approximate and therefore not revealable | Plain text only                  | Search accelerator only, never SSR authority.              |
| Headless browser per request        | Still models wrong client environment | Expensive approximation                  | Potentially broad                | Reject; wrong client, poor edge/cache/streaming behavior.  |
| Client-only component               | No component hydration issue          | Blank until JS                           | Yes after mount                  | Valid fallback behavior, but insufficient as the main API. |

## Recommended contract

### 1. Fix hydration determinism first

Split native selection into semantic eligibility and browser capability.

- Single-line native modes are already deterministic.
- For legacy multi-line clamping, render the same eligible native styles on server and first client
  render. The specified `-webkit-line-clamp`/`-webkit-box`/vertical-orientation combination is safe
  to send to every browser. Pair it with an independent block-size/overflow guard so a browser that
  ignores line-clamp still cannot paint an extra line.
- Feature-detect only after mount. If unsupported, transition to the measured mode through ordinary
  Vue state rather than changing the first hydration VNode.
- Ensure Rich renders or omits its hidden probe from a hydration-stable initial mode.
- Add SSR render and real browser hydration tests before any visual enhancement.

This removes the current correctness bug without inline scripts or a new public prop.

### 2. Introduce an explicit internal/public pending state

Use a state vocabulary such as:

- `pending`: an active measured constraint exists but the browser has not settled it;
- `fit`: measured and not clamped;
- `clamped`: measured and clamped;
- `expanded`, `inactive`, and Rich `fallback` as already meaningful non-pending states.

Recommended observable surface:

- a stable root hook such as `data-clamp-state="pending|fit|clamped|expanded|fallback"`;
- additive `pending` slot props so controls and `hiddenItems` summaries can avoid treating unknown as
  false;
- consider an exposed `pending` getter if wrapper components need the same distinction;
- emit the first `clampchange` only after a real browser decision, including an initial measured
  `false`, instead of emitting a synthetic pending false.

Expanded, empty, and unlimited states are known on the server and should not be pending.

### 3. Make hard paint containment part of component markup

The absolute invariant cannot rely on consumers remembering an optional stylesheet. Active collapsed
SSR markup itself must carry the minimum inline containment needed to fail closed, while an explicit
`vue-clamp/ssr.css` export can own non-critical placeholder styling.

- expose `data-clamp-state="pending"` and server/client-stable limit custom properties;
- send exact `max-height` and native single/multi-line styles inline when applicable;
- keep unprovable content `visibility: hidden` and give its root a bounded placeholder block size so
  streaming gaps do not reserve the full source height;
- never use fade as a correctness mechanism and never reveal an `lh` estimate as if it were exact;
- under `scripting: none`, retain the hard cap or hidden state. The authored source remains in HTML
  and can be mirrored in an accessibility-only node where that does not duplicate interactive DOM.

This is intentionally fail-closed. `@media (scripting)` cannot prove that hydration will actually
run: CSP, extensions, a failed bundle, or a lazy island can leave scripting reported as enabled.
Showing full content in those cases would contradict the requested guarantee.

### 4. Promote parser-time bootstrap to the exact first-paint path

The React Wrap Balancer-like path should be a designed SSR entry/provider rather than a post-mount
optimization:

- use Vue `useId()` for server/client-stable identifiers;
- emit each hidden/hard-contained root immediately followed by a classic inline invocation with no
  `async`, `defer`, or module semantics;
- keep the shared solver in a provider or external bootstrap, and read source/options from DOM data;
  never interpolate user text or trusted HTML into executable script strings;
- measure synchronously in the actual connected DOM, commit only the exact bounded candidate, write
  a compact seed to the root, then reveal it;
- read the seed synchronously during client `setup()` so the first VNode represents the already
  mutated DOM rather than asking Vue to repair a mismatch;
- install resize/font invalidation before hydration, matching the early-observer lesson from React
  Wrap Balancer;
- preserve hard containment while revalidating and atomically reveal the new exact result;
- support a request `nonce`; for SSG/strict CSP, make the invocation byte-identical and hashable or
  use an external bootstrap that discovers pending roots;
- keep `data-allow-mismatch` as a diagnostic escape hatch, never as the handoff mechanism.

Classic parser-inserted scripts execute before parsing continues. Parser-blocking scripts also wait
for preceding render-blocking stylesheets, which is useful because the solver needs final CSSOM
geometry. The root and its adjacent script can still arrive in different streaming chunks, so the
hidden/hard-contained root is required even when the eager path is enabled. A framework integration
may additionally place the shared provider in `<head>`; a leaf component cannot assume authority to
do that. Layout-affecting CSS must be available before the component script; late CSS and web-font
changes are handled by early observers while the independent paint cap remains active.

### 5. Define honest coverage tiers

| Component/mode                                      | Before-hydration result under the hard contract                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Native Inline / native-compatible Line              | Exact from server CSS; hydration later measures only the `clamped` state.                        |
| Plain measured Inline / Line, stable affix geometry | Exact parser-time solver and seed handoff are feasible.                                          |
| Wrap without result-dependent before/after slots    | Feasible: keep all item shells, bootstrap hides the exact suffix, client adopts seed.            |
| Wrap with `hiddenItems`/`clamped`-dependent slots   | Hidden until Vue settles, unless caller opts into a strict SSR-stable slot contract.             |
| Native-compatible Rich                              | Exact from server CSS.                                                                           |
| Measured Rich                                       | Hidden until Vue settles; duplicating the rich solver into inline bootstrap is unsafe and large. |

For Wrap hydration, the first client VNode can temporarily keep all server item shells materialized
with the bootstrap-selected suffix set to `display: none`, then remove the hidden shells after
hydration. This keeps DOM identity stable without painting extra rows. For plain text, render a
stable visible candidate node plus a separate source/a11y node from the start so bootstrap changes
text, not structure.

Result-dependent slots are the irreducible boundary. A general script cannot execute a Vue render
function, and duplicating every possible slot variant would create incorrect IDs, custom-element
effects, and resource loads. "Perfect first visible paint" is still possible across the API, but in
those modes the first visible paint necessarily waits for Vue; it is not an exact SSR-computed slot
result.

## Delivery order

1. **SSR correctness and paint-safety release**
   - deterministic native mode across server/first client render;
   - Node `renderToString` coverage for all component/mode partitions;
   - Chromium hydration regression for the current multi-line mismatch;
   - hard inline containment and no-overpaint browser assertions before/during hydration and resize.
2. **Explicit pending and accessibility contract**
   - state hook and slot semantics;
   - stable source/a11y DOM and bounded hidden placeholders;
   - delayed-hydration, disabled-JS, CSP-blocked, and font/container transition tests.
3. **Eager bootstrap prototype, benchmark-only first**
   - plain Line, measured Inline, and slot-independent Wrap;
   - provider versus per-instance HTML/payload comparison;
   - CSP nonce/hash, streaming, and XSS-serialization tests;
   - first-contentful-paint and layout-shift evidence under throttled JS/fonts.
4. **Promotion only if evidence is positive**
   - choose default versus opt-in based on parser cost and framework/CSP integration;
   - keep measured Rich and result-dependent slots hidden pending unless a safe contract is proved.

## Required validation matrix

- `renderToString`, Node streaming, and Web `ReadableStream` output;
- Chromium, WebKit, and Firefox hydration with console mismatches treated as failures;
- native and measured partitions for every component;
- exact-fit and overflow cases, `maxLines`, `maxHeight`, custom ellipsis, start/middle/end, word and
  grapheme boundaries;
- empty, unlimited, expanded, Rich fallback, unsafe-rich-source, and zero-width states;
- static and result-dependent before/after slots, including `WrapClamp.hiddenItems`;
- JavaScript disabled, hydration delayed, component lazy hydration, and bootstrap blocked by CSP;
- request nonce, static CSP hash, `</script>`, quotes, U+2028/U+2029, and hostile text/HTML data;
- web-font load before and after hydration, container resize before and after hydration, responsive
  CSS, RTL, zoom, and transformed ancestors;
- snapshots before hydration, immediately after hydration, first paint, and final settlement;
- LayoutShift/paint metrics plus structural counters so a smaller visual transition is not bought by
  excessive parser-blocking work or HTML growth.

## Sources

- React Wrap Balancer source:
  https://github.com/shuding/react-wrap-balancer/blob/main/src/index.tsx
- React Wrap Balancer README and package surface:
  https://github.com/shuding/react-wrap-balancer
- React Wrap Balancer web-font/early-observer fix:
  https://github.com/shuding/react-wrap-balancer/pull/20
- React Wrap Balancer CSP nonce change:
  https://github.com/shuding/react-wrap-balancer/pull/61
- React Wrap Balancer strict-CSP/static-site limitation:
  https://github.com/shuding/react-wrap-balancer/issues/78
- Vue SSR guide and hydration mismatch guidance:
  https://vuejs.org/guide/scaling-up/ssr.html
- Vue SSR API and `data-allow-mismatch`:
  https://vuejs.org/api/ssr.html
- Vue SSR-stable `useId`:
  https://vuejs.org/api/composition-api-helpers.html#useid
- Vue 3.5 lazy hydration strategies:
  https://vuejs.org/guide/components/async.html#lazy-hydration
- HTML classic-script parsing and render-blocking model:
  https://html.spec.whatwg.org/multipage/scripting.html
- MDN script execution attributes and `blocking="render"`:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script
- Browser layout measurement through `getBoundingClientRect()`:
  https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
- CSS `line-clamp` behavior and availability:
  https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp
- CSS Overflow Level 4:
  https://drafts.csswg.org/css-overflow-4/
- CSS `text-wrap: balance` behavior and browser line limits:
  https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
- CSS `scripting` media feature:
  https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/scripting
