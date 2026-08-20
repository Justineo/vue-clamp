# Paid-signal cold search and native structural cloning

## Decision rule

The first-principles cost in measured clamping is browser layout, followed by connected-DOM
mutation. A failed full-source probe is therefore more valuable than a boolean: the browser has
already returned a width, physical line count, or bounding height. Reusing that magnitude as the
first search rank is nearly free, provided it remains a hint and every final candidate is still
measured.

The retained gate is deliberately conservative:

- no compatible warm hint already exists;
- more than 16 candidate boundaries remain;
- multiline inputs use the hint only when the full source is at least three times the measured
  capacity;
- word mode moves to grapheme fallback ranks when the whole-word candidate space is too small;
- the browser fit predicate remains authoritative.

This avoids turning a proportional text model into layout proof. It only changes binary-search
probe order.

## Retained implementations

### LineClamp

The failed full-text probe exposes either the text fragment count for `maxLines` or the content
bounding height for `maxHeight`. The retained cold hint maps candidate count by
`candidateCount * capacity / fullSize` behind the three-times-capacity gate.

At fixed `180px` width with six long-token semantic updates, the Range-only checkpoint versus the
retained implementation measured:

- bounding-rect reads: `1536 -> 1080` (`-29.7%`);
- hidden character-data mutations: `1020 -> 600` (`-41.2%`);
- median active time: `31.9 -> 22.0 ms` (`-31.0%`).

### InlineClamp

For unsplit one-line text, a failed full-body `scrollWidth` read gives the available/full width
ratio directly. Split layouts are excluded because fixed prefix/suffix occupancy makes a bare body
ratio incomplete.

At fixed `160px` width with six long-token semantic updates:

- `scrollWidth` reads: `960 -> 660` (`-31.3%`);
- hidden mutations: `1128 -> 828` (`-26.6%`);
- median active time: `25.8 -> 20.8 ms` (`-19.4%`).

### RichLineClamp

Raw `DOMRectList.length` is not a physical line count for rich content. Nested inline wrappers can
emit multiple fragments on one visual line, and an early prototype using the raw count regressed a
wide fixed-width row from `1152` to `1536` bounding-rect reads and from `78.2` to `83.5 ms`.

The retained helper groups fragments by top/bottom coordinates using the same `0.5px` tolerance as
final rich fit checks. Against the no-hint checkpoint on that wide row, accurate physical-line
seeding reduced bounding-rect reads `1152 -> 768`, mutations `13344 -> 12576`, and median active
time `78.2 -> 68.1 ms`. On the fixed `180px` semantic-update row it measured:

- bounding-rect reads: `1152 -> 768` (`-33.3%`);
- mutation and clone counts unchanged;
- median active time: `74.6 -> 62.1 ms` (`-16.8%`).

### Native rich suffix cloning

Structural source boundaries already map exactly to DOM Range endpoints. The retained patcher uses
`Range.cloneContents()` instead of maintaining a second recursive JavaScript clone algorithm.
Images are rewritten to the inert probe source before the cloned fragment is connected, and
prepared rich state records whether images exist so image-free fragments avoid a query.

This was timing-neutral in focused rich rows, but removed roughly 100 lines and reduced the package
by about `1.55 kB` raw / `0.27 kB` gzip. It also deletes a second implementation of browser tree
cloning semantics.

### Preparation and shared layout cleanup

- ASCII text validation and boundary filling now happen in one pass. A 737-character Node
  diagnostic reduced 100,000 boundary preparations from roughly `134-136 ms` to `64-67 ms` for
  the allocation/fill path.
- simple-line calibration scans an immutable `DOMRectList` once per fit result rather than once for
  every newly discovered line.
- Wrap's no-affix and before-only uniform-width grow predictions now share one static-flow hint
  function. A countertracked A/B across 11 grow/shrink rows kept every structural counter identical
  and aggregate timing neutral while reducing the isolated Wrap consumer by `0.094 kB` gzip versus
  the pre-cleanup checkpoint.

## Size trade

Compared with the Range-only checkpoint, isolated consumer bundles change by:

| Component       | Raw delta | Gzip delta | Covered cold-row active change |
| --------------- | --------: | ---------: | -----------------------------: |
| `LineClamp`     |    +463 B |     +144 B |                         -31.0% |
| `InlineClamp`   |    +369 B |      +82 B |                         -19.4% |
| `RichLineClamp` |    +603 B |     +176 B |                         -16.8% |
| `WrapClamp`     |    -673 B |      -94 B |  neutral structural/timing A/B |
| All components  |    +782 B |     +288 B |                              — |

These are favorable byte/work trades. Rich remains the most expensive component overall, but the
new cold hint is not the source of that imbalance.

## Rejected directions

- Raw rich fragment count: rejected because fragments are not physical lines and wide inline-rich
  content regressed materially.
- Rich `maxHeight` proportional hint: rejected after increasing probes from `16` to `33` in the
  focused row.
- Template-element parsing: saved only about `8 B` gzip and made steady rich Range cloning much
  slower; `DOMParser` keeps the prepared root in a document context that Range handles better.
- A shared proportional-hint helper: rejected because it increased gzip and obscured component-
  specific validity gates.
- Lazy `Intl.Segmenter`, cached `DOMParser`, and preallocated rich point arrays: rejected because
  each added bytes or had negligible end-to-end value.
- Presizing the generic offset-to-point list: faster in a tiny JavaScript microbenchmark, but added
  gzip for work dominated by browser layout.
- Cross-instance candidate batching: still rejected. It can reduce layout flushes only by assuming
  CSS/layout independence that the public styling contract does not provide.

## Higher-level conclusion

The useful new abstraction is not another cache. It is **information recovery from an unavoidable
browser read**. Paid signals may seed a search, but cannot authorize a result. This keeps the
correctness boundary simple, works with cross-origin styles because it observes rendered geometry
rather than stylesheet rules, and gives cold semantic changes a bounded optimization path without
maintaining a complete CSS-environment identity.
