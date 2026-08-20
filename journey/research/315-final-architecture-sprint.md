# Final architecture sprint

## Decision rule

This pass reopened the design space rather than treating the retained search and patch paths as the
complete set of options. A candidate still had to satisfy three gates:

1. browser-observed layout remains authoritative, including inherited and cross-origin styling;
2. unsupported DOM/layout cases preserve authored content instead of approximating it;
3. a local optimization must either remove measurable browser work or reduce shipped code without
   creating a comparable hot-path cost.

Small wins that changed layout semantics were rejected. The reliability threshold is intentionally
higher than the size threshold.

## Retained native-source deferral

`RichLineClamp` now resolves expanded, unlimited, empty, and native-eligible modes before evaluating
its prepared-HTML computation. Default native multiline mounts and HTML updates therefore keep the
authored DOM and do not invoke `DOMParser`; preparation remains lazy until the measured engine is
actually required or a previously patched tree must be restored.

A browser regression spies on `DOMParser.prototype.parseFromString`: native mount and HTML updates
perform zero parses, then switching to `boundary="word"` performs exactly one. In a counterbalanced
15-run same-process comparison, the new 16-instance/six-update native Rich row moved from about
`14.7 ms` to `10.9 ms` median active time (`-25.9%`). The absolute row is small and noisy, but the
eliminated parse work is directly asserted rather than inferred from elapsed time.

The initial change added about `218 B` raw / `30 B` gzip. Two behavior-equivalent cleanups then
replaced static clone-guard sets with anchored regular expressions and removed an array allocation
from the Line fit key. The complete sprint moved the built runtime from `131,885 B` raw / `28,656 B`
gzip to `131,909 B` raw / `28,673 B` gzip: `+24 B` raw / `+17 B` gzip overall.

## Rejected structural replacements

### Layout containment

Adding `contain: layout` to the connected Rich probe produced a consistent roughly `1-4%` timing
improvement across sampled Rich rows for only a few gzip bytes. It was still rejected: layout
containment establishes a new formatting/containing-block context and can change percentage,
positioning, float, and intrinsic-size behavior. The measured probe is supposed to reproduce
consumer layout, and a small timing win does not justify narrowing that semantic contract.

### Range geometry as a search model

A full-tree `Range.getClientRects()` probe was tested as a cold rank hint. It added about `630 B` raw
/ `149 B` gzip, left the targeted structural counters unchanged, and made elapsed time worse. The
browser exposes aggregate fragments but not a reliable source-boundary mapping, so this adds a read
without replacing the existing authoritative candidate checks.

### Range deletion as the patch representation

`Range.deleteContents()` was prototyped as one native implementation for both full-to-clamped and
backward Rich patches. It passed the 148-test focused browser contract and reduced the runtime by
about `1.23 kB` raw / `90 B` gzip, but changed browser work in the wrong direction. Four focused
rows moved from approximately `544.8 -> 599.7 ms`, `491.5 -> 501.5 ms`, `152.9 -> 167.8 ms`, and
`60.8 -> 80.2 ms`. Range deletion generated substantially more character-data mutation records
even where child-list records fell. Browser-native code is not automatically cheaper than narrow
manual DOM operations, so the replacement was reverted.

### Visible-source preflight

Measuring the authored visible Rich DOM before parsing can skip the entire measured engine when the
source already fits. The same preflight, however, adds a second authoritative layout pass whenever
the source overflows unless its result is threaded through the whole hidden-probe search protocol.
The broad prototype materially slowed the Rich browser suite and duplicated work on the dominant
overflowing cases. A short-content heuristic would only move the uncertainty into an arbitrary
gate, so the path was reverted instead of expanded.

### Preparation and cache substitutions

- Fusing rich preparation, image detection, and clone-safety inspection added `305 B` raw / `56 B`
  gzip and moved the cold semantic row from about `59.3 ms` to `61.4 ms`.
- A typed-array ASCII offset representation saved only `7 B` raw / `2 B` gzip and made a 100,000-call
  preparation microbenchmark roughly `10-20%` slower.
- Replacing Vue's lazy computed preparation with a manual memo added `279 B` raw / `55 B` gzip.
- Removing the native multiline style cache saved `46 B` gzip but allocated a style object on every
  render and produced mixed-to-negative native-row timing. The cache was retained.

## Foundation-level conclusion

The highest-leverage abstraction is now **mode partition before representation construction**:
delegate exact semantic subsets to CSS and do not instantiate the measured representation until a
requested behavior genuinely needs it. This is stronger than another search tweak because it
removes parsing, cloning, style inspection, candidate mutation, and layout probes together.

Inside the measured partition, layout reads remain about half of Rich active time and are also the
correctness oracle. The explored browser primitives did not expose a trustworthy mapping from a
single geometry read to the final structural boundary. Further large gains therefore need one of
two explicit product-level changes: a separately importable native-only surface, or a new Rich probe
representation with a written DOM/accessibility contract. Neither should be smuggled into the
current API as an incremental optimization.

## Final production-minified size attribution

The final size pass bundles every non-empty component subset as an ES module with Vue external and
production minification, then applies Shapley attribution to the current-minus-`main` gzip delta.
This avoids both shared-code double counting and whole-package raw-size distortion.

| Component       | Isolated gzip `main` | Isolated gzip current | Isolated delta | Attributed delta |
| --------------- | -------------------: | --------------------: | -------------: | ---------------: |
| `LineClamp`     |             3.959 kB |              8.000 kB |      +4.041 kB |        +2.519 kB |
| `InlineClamp`   |             2.445 kB |              4.669 kB |      +2.224 kB |        +1.274 kB |
| `RichLineClamp` |             5.472 kB |             11.534 kB |      +6.062 kB |        +4.927 kB |
| `WrapClamp`     |             4.253 kB |              4.748 kB |      +0.495 kB |        +0.290 kB |
| All components  |            10.240 kB |             19.250 kB |      +9.010 kB |        +9.010 kB |

Rich owns about 54.7% of attributable growth and remains the least favorable strict byte/time
trade. Its measured engine is also the correctness boundary for non-native rich semantics, and the
ablation evidence rejects deleting its guarded search and identity-preserving patch paths. Wrap
owns only about 3.2% of growth; its smaller speedup is not a practical size concern. Inline remains
the strongest trade, while Line is intermediate.

## Final `main` performance matrix

The final counterbalanced counters-off smoke passes all `124/124` scenarios. Summed per-scenario
median active time moves as follows:

| Component       | Scenarios | `main` active | Current active | Change |
| --------------- | --------: | ------------: | -------------: | -----: |
| `LineClamp`     |        42 |    7,278.4 ms |     5,826.9 ms | -19.9% |
| `InlineClamp`   |        11 |    2,229.6 ms |     1,385.9 ms | -37.8% |
| `RichLineClamp` |        44 |    8,179.0 ms |     6,128.7 ms | -25.1% |
| `WrapClamp`     |        27 |    3,520.7 ms |     3,219.4 ms |  -8.6% |
| Total           |       124 |   21,207.7 ms |    16,560.9 ms | -21.9% |

This run is deliberately a broad smoke rather than a confidence claim for every row. A previous
independent full matrix reported a larger `-30.9%` aggregate improvement. Both runs agree on the
component ordering and on a substantial overall gain; structural counter A/Bs remain the proof for
individual retained algorithms.
