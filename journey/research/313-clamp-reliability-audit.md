# Clamp reliability audit

## Decision rule

Performance state may narrow or warm a browser-measured search, but it must not be treated as proof
of a final layout result unless the complete validity boundary is local and auditable. When the CSS
environment cannot be represented completely, the implementation prefers a measured fallback and a
narrower supported contract over additional invalidation heuristics.

## Benchmark ordering

Multi-target package runs previously executed every target in a fixed order. A same-package A/A smoke
showed the second column roughly 15% slower despite identical structural counters. Warmup and measured
rounds now alternate forward and reverse target order.

A four-scenario, four-sample A/A smoke after counterbalancing reported aggregate median active time
of 350.3 ms versus 345.1 ms, a 1.5% gap, with identical layout and mutation counters. Timing remains
secondary to structural evidence when row-level uncertainty is high.

## Final-result cache removal

LineClamp, InlineClamp, and RichLineClamp previously returned exact-width cached results without a
current browser fit check. Their keys covered selected width, style, affix, and stylesheet state but
could not completely represent inherited metrics, ancestor attribute selectors, container context,
or other cascade inputs.

The caches and shared LRU/key helpers were removed. Previous measured states remain warm-search hints,
and final candidates are measured in the current layout. Browser regressions cycle through a repeated
width while an ancestor attribute selector changes inherited letter spacing; Line, Inline, and Rich
must all recompute a shorter result.

Focused same-process evidence:

| Workload set                          | Cache build | Measured build |  Delta |
| ------------------------------------- | ----------: | -------------: | -----: |
| Eight repeated/novel scenarios        |    747.8 ms |       869.0 ms | +16.2% |
| Six repeated-width pressure scenarios |    479.5 ms |       605.6 ms | +26.3% |
| Two novel-width controls              |    268.3 ms |       263.4 ms |  -1.8% |

The regression is concentrated in synthetic workloads with many repeated assignments. That evidence
does not justify reintroducing a verified-result cache yet. Any future hint must still measure the
current candidate and needs representative application evidence beyond repeated-width stress.

## Rich CSS dependency boundary

Rich layout metadata previously scanned `document.styleSheets` to fingerprint selectors, display,
and line-metric declarations. This was both incomplete and costly: cross-origin rule lists can be
unreadable, and readable CSSOM still cannot fully encode element-specific container context, ancestor
attribute selectors, shadow styles, or every dynamic cascade input.

The retained policy is:

- all-text Rich content may reuse structural runs and rank points;
- element-bearing Rich content restores the full hidden probe and reads local computed styles on
  every reclamp;
- atomic paths, logical runs, and simple-line eligibility are rebuilt from final browser styles;
- runtime code does not read stylesheet rule lists.

A regression changes a static ancestor attribute selector from transparent inline text to an
inline-block atomic run without changing stylesheet text. The reclamp must rebuild the atomic path
and return only the ellipsis at the narrow test width. A separate regression makes stylesheet
`cssRules` unreadable and verifies that layout refresh remains correct without reading it.

## Probe representation

The earlier normalized probe unwrapped transparent spans. Under mandatory element reinspection it
required rebuilding the full source tree for style reads and then rebuilding the normalized tree for
search. In the wrapper-heavy long-token row this produced about 70,080 style reads, 960
`replaceChildren` calls, and a 348 ms active median.

Keeping the source wrapper representation removed the full/normalized round trip:

| Four representative Rich scenarios | Normalized refresh | Source wrappers |  Delta |
| ---------------------------------- | -----------------: | --------------: | -----: |
| Aggregate active median            |         1,076.7 ms |        913.7 ms | -15.1% |
| Long-token active median           |           348.1 ms |        173.9 ms | -50.0% |
| Long-token style reads             |             70,080 |          14,880 | -78.8% |

Compared with the pre-reliability metadata-reuse build, the same four source-wrapper scenarios are
about 10.3% slower overall. The long-token row remains about 49.5% slower in relative terms, but its
final cost is approximately 5.1 ms per width step across 16 instances, or 0.32 ms per instance. This
is the retained balancing point: local browser truth with bounded absolute cost and much less runtime
machinery.

## Connected-probe safety boundary

Measured Rich clamping needs a connected clone to obtain browser layout, but arbitrary DOM cannot be
made inert by styling it offscreen. Custom-element lifecycle callbacks, duplicate document IDs,
form ownership, embedded resources, and inline handlers are observable even when the clone is
`aria-hidden`.

The retained boundary is deliberately narrower than an arbitrary-DOM sanitizer:

- potential custom elements and customized built-ins are rejected before cloning;
- document/form identity attributes, inline event handlers, active embedded/form tags, and active
  SVG references or animation elements are rejected;
- the source preflight is cached by prepared-source identity, while current affix DOM is checked on
  each measured recompute;
- the connected probe is `inert` as defense in depth and carries the public content/body `data-part`
  hooks so supported descendant styling rules apply in the measured tree;
- unsupported source is left fully visible and unclipped.

Fallback is latched until clamp inputs change. Without that state-machine rule, an unsafe affix
rendered only while `clamped` can oscillate forever: the no-affix state clamps, the affix appears,
the unsafe state falls back, and the affix disappears. A browser regression covers that exact
conditional custom-element slot shape.

## Native Rich partition

The reliability work made the remaining measured cost explicit. In one counterbalanced 41-scenario
Rich comparison, the pre-audit exact-cache build and the reliable measured build had the following
shape before native Rich was added:

| All 41 Rich scenarios | Pre-audit build | Reliable measured build |   Delta |
| --------------------- | --------------: | ----------------------: | ------: |
| Active median sum     |       5772.9 ms |               7398.5 ms |  +28.2% |
| Bounding rect reads   |          99,205 |                 114,711 |  +15.6% |
| Client rect reads     |          21,243 |                  49,376 | +132.4% |
| Client rect entries   |          65,719 |                 235,127 | +257.8% |
| Mutation records      |         171,280 |                 505,858 | +195.3% |
| Computed-style reads  |          12,416 |                 208,496 |  +1579% |

The older build is not a correctness target, but the counter movement proves that the expensive
work is architectural: restoring and inspecting a connected rich tree, not a small search-window
constant. That is large enough to justify a semantically exact feature partition.

`RichLineClamp` now shares the existing native CSS path for default end/grapheme/default-ellipsis
`maxLines` cases. One-line native Rich can reserve an `after` slot; multiline native Rich requires no
rendered `after` slot. Word boundaries, custom ellipsis, and `maxHeight` remain on the measured path.
Native mode keeps the full authored DOM and does not render a probe, so custom elements do not gain a
second connection. A live-DOM marker restores measured shortened content before switching modes.

A same-process five-scenario comparison covers article-fit, continuous inline markup, trailing-space
markup, emoji/ZWJ novel widths, and dense rich rows:

| Five native-eligible Rich scenarios | Pre-audit build | Native Rich |  Delta |
| ----------------------------------- | --------------: | ----------: | -----: |
| Active median sum                   |       1138.5 ms |    610.1 ms | -46.4% |
| Bounding rect reads                 |          17,148 |      13,296 | -22.5% |
| Client rect reads / entries         |   3,225 / 8,216 |       0 / 0 |  -100% |
| Mutation records                    |          28,762 |      13,296 | -53.8% |
| Child-list mutations                |           4,628 |           0 |  -100% |
| Hidden mutations                    |          12,450 |           0 |  -100% |
| Computed-style reads                |           1,520 |           0 |  -100% |

Native overflow detection adds 4,432 `clientWidth` and 4,432 `clientHeight` reads across those rows,
but removes candidate search and connected-clone work. This is the foundation-level optimization
direction for layout-sensitive components: partition out a browser-native semantic subset instead
of trying to make an incomplete cache or layout model authoritative.

## Attributed measured-path cost

The package benchmark now times layout reads by category instead of reporting only call counts. A
focused three-scenario Rich sample attributed about 377.2 ms of 724.6 ms active time (52%) directly
to layout reads: about 203.2 ms in bounding rectangles and 172.4 ms in client rect lists. Computed
style reads took about 4 ms. Candidate geometry and the write/read search loop are therefore the
current measured-path bottleneck; stylesheet scanning or clone construction is not.

The clone spy previously missed Rich source clones because those nodes live in a detached
`DOMParser` document outside the tracked component root. Counting element clones during the isolated
measured window exposed 2,304 clones in `rich-metadata-affix-batch-jumps`, but timing those clones
accounted for only about 0.7 ms of 92.3 ms active time, versus 53.1 ms in layout reads. A clone-free
representation is not justified by clone construction cost alone. The benchmark also now records
`scrollHeight`; native Line/Rich rows had real overflow reads that the old counter set omitted.

## Rejected cross-instance batching

A round-batched Rich solver was prototyped to write candidates for many instances before reading
their layouts. It produced large gains at 64 instances, confirming that repeated style/layout flushes
are a real scale effect. It also failed browser correctness reproducibly. Candidate DOM writes from
different instances are not independent when selectors, custom properties, ancestor layout, or
shared formatting context can couple them. Containment or shadow isolation would change public CSS
semantics rather than prove equivalence.

The prototype was removed. Cross-instance write/read batching is not a safe core optimization unless
an equivalent CSS/layout isolation contract can be proved first. Scheduling recomputes in the same
task without that isolation is not enough.

A separate predicted Rich rank-start experiment was also rejected. It improved a novel-jitter row
from 3,328 to 3,136 bounding-rect reads, but regressed repeated jitter from 9,328 to 11,440 reads and
increased mutations. One noisy width/rank slope is not a sufficiently stable target model; the
retained code keeps the narrower observed-slope and warm-search rules.

## Native Inline partition and measured history hints

`InlineClamp` now uses native `text-overflow` for the exact default subset: no `split`, end location,
grapheme boundary, and the default `…` ellipsis. It keeps the full source text in the DOM and does
not install ResizeObserver or font listeners in that mode. Split content, start/middle locations,
word boundaries, and custom ellipsis strings stay measured.

Same-process counters-off evidence for the default Inline rows:

| Default Inline workload | Measured path | Native path |  Delta |
| ----------------------- | ------------: | ----------: | -----: |
| Continuous resize       |      474.1 ms |    122.9 ms | -74.1% |
| Repeated jumps          |      106.9 ms |     17.7 ms | -83.4% |
| Aggregate               |      581.0 ms |    140.6 ms | -75.8% |

An external-parent resize row, where the component itself receives no width prop update, reduced
active time from 105.3 ms to 2.8 ms, bounding-rect reads from 864 to 0, scroll-width reads from 2,688
to 0, mutations from 2,994 to 18, and ResizeObserver callbacks from 288 to 0.

Measured Inline modes retain a small history of at most eight exact-width boundary ranks. This is
not a result cache: it stores no rendered strings, does not return a previous answer, and every
candidate is rechecked in the current browser layout. A historical rank is used only without
`split`, when it belongs to the current prepared boundaries, represents a clamped result, and is
farther from the latest rank than the normal warm-search coverage. This preserves the existing
nearby-width path and avoids the regressions seen in a broader prototype.

Focused repeated-jump structural evidence for the retained gate:

| Measured Inline row | Scroll-width reads |      Mutations |    Active median |
| ------------------- | -----------------: | -------------: | ---------------: |
| Middle              |     2,748 -> 1,365 | 3,893 -> 2,706 | 103.5 -> 86.0 ms |
| Word                |     2,016 -> 1,152 | 2,720 -> 2,368 |  95.6 -> 93.8 ms |
| Custom ellipsis     |     2,688 -> 1,344 | 3,824 -> 2,672 |  99.7 -> 94.8 ms |

The middle-jitter and split-file-path controls keep identical structural counters. A counters-off
rerun of the three affected rows reduced aggregate active median from 302.9 ms to 264.1 ms (-12.8%).
The same-width inherited-metric browser regression still passes because the historical rank is only
the first measured probe, never layout proof.

The same candidate-history idea was not generalized to LineClamp. A six-row prototype reduced total
bounding-rect reads from 32,528 to 31,568, including useful jump-row reductions, but the word jitter
control increased from 12,144 to 12,192 reads and its mutations increased from 11,536 to 11,776.
Aggregate active median also moved from 965.1 ms to 1,087.5 ms under noisy counter tracking. The
broader Line state did not meet the neutral-held-out gate, so it was removed.

A smaller native multiline getter optimization was also removed. Replacing the clamped content's
`clientWidth` read with an already-known root width eliminated 1,152 getter reads in focused rows,
but a positive root width does not prove that consumer CSS has not collapsed the content box to
zero. The timing difference was noisy and the semantic guard was weaker, so the final code reads
the content box directly. The browser regression now repeats the zero-content-width assertion after
a root width update to cover the fresh-snapshot path.

## Benchmark coverage changes

The public matrix now includes external-parent resize rows for Line, Inline, and Rich. Their parent
grid changes width while each component remains `width: 100%`, so ResizeObserver and native CSS paths
are exercised independently of component prop-style updates. Multi-target rounds alternate target
order, aggregate totals are emitted last to survive terminal truncation, and timing attribution now
separates bounding rects, client rects, layout getters, computed style, and clone construction.

## Size and validation

Removing authoritative result caches, stylesheet scanning, and normalized source/probe mapping
reduced the package runtime from 154.92 kB raw / 33.02 kB gzip to an intermediate 137.34 kB raw /
29.22 kB gzip. The passive-probe guard, native Rich/Inline partitions, and measured Inline rank
history add explicit reliability and fast-path code. The post-audit baseline was 141.56 kB raw /
30.39 kB gzip.

A final bare-minimal convergence pass reduced that baseline to 132.49 kB raw / 28.66 kB gzip. The
all-component consumer bundle fell from 20.506 kB to 19.340 kB gzip. The retained changes are mostly
representation simplifications rather than new semantic fast paths:

- Text and Rich warm-cost control flow was flattened without changing candidate policy.
- Text/Inline context matching, clamped-width tracking, and full-candidate verification now share
  one implementation instead of parallel copies.
- Font invalidation no longer parses `FontFace.family`, walks descendant font declarations, or uses
  unchanged outer boxes as an incomplete no-op proof. Every delivered event conservatively clears
  font-sensitive state and reclamps unless another same-frame invalidation already did so.
- The numeric font-scale/full-rank pre-search recovery heuristic was removed. Correctness remains at
  the final full-candidate verification boundary; the rare recovery row may do more patch work.
- Redundant helper types, proof-only test controls, and an unused numeric parser were deleted.

The font simplification intentionally regresses synthetic generic/unused-font no-op rows. A focused
same-process run shows ordinary font-size-change and loaded-used-family rows keep their structural
work, while generic/unused same-width events now perform the same conservative reclamp. This is a
reliability/size trade: the removed proof could not cover cross-origin rules, inherited fallback
fonts, container context, or the complete cascade.

Several smaller-looking Rich deletions were rejected. Removing forward prefix patch paths saved
about 0.38 kB package gzip but broke the stable-descendant identity contract and increased mutation
or clone work. Removing the backward whole-prefix path saved about 0.15 kB gzip but added roughly
3-6% mutation work in the long-token hotspots. Removing the full-to-clamped path saved about
0.13 kB gzip but raised child-list mutations by 22-39% in affected copy/metadata rows. Those are not
acceptable byte/performance or byte/reliability trades.

The final public matrix passes all `120/120` package scenarios, including the three new
external-parent resize rows. The native follow-up ran all 41 Rich scenarios and a counterbalanced
five-scenario comparison against the pre-audit build. Detailed timing remains secondary to
structural counters.

The final implementation passes 62 unit tests, 265 Chromium browser tests, formatting/lint/type
checks, and the complete package plus website build.

## Final `main` Comparison and Component Size Budget

The final counters-off comparison uses the current worktree and `main` at `b48fbcc` in the same
Chromium process. All `120/120` scenarios passed. The table sums two-sample median active time across
each component's scenarios; individual rows remain noisy, while an earlier independent full run
reported a similar total reduction of 23.3%.

Consumer size is measured from minified ES bundles with Vue external. Isolated component bundles
show what a consumer pays when importing only that component, but they double-count shared code.
The fair-attribution column is the Shapley value of the current-minus-`main` gzip delta over all 15
non-empty component subsets.

| Component       | Isolated gzip `main` | Isolated gzip current | Isolated delta | Attributed delta | Active ms `main` | Active ms current | Change |
| --------------- | -------------------: | --------------------: | -------------: | ---------------: | ---------------: | ----------------: | -----: |
| `LineClamp`     |             3.888 kB |              7.837 kB |      +3.949 kB |        +2.426 kB |          6,594.8 |           5,056.8 | -23.3% |
| `InlineClamp`   |             2.404 kB |              4.580 kB |      +2.176 kB |        +1.223 kB |          1,807.5 |           1,014.8 | -43.9% |
| `RichLineClamp` |             5.414 kB |             11.549 kB |      +6.135 kB |        +4.988 kB |          7,367.2 |           5,259.1 | -28.6% |
| `WrapClamp`     |             4.183 kB |              4.770 kB |      +0.587 kB |        +0.398 kB |          3,553.6 |           3,240.8 |  -8.8% |
| All components  |            10.305 kB |             19.340 kB |      +9.035 kB |        +9.035 kB |         19,323.2 |          14,571.6 | -24.6% |

RichLineClamp still accounts for 55.2% of attributable extra gzip and 44.4% of the aggregate
active-time saving, so it has the weakest strict byte/time ratio. That does not justify a coarse
rollback: predictor deletion raises held-out layout/mutation work, while patch-path deletion either
breaks descendant identity or has a poor byte/work ratio. InlineClamp remains the strongest
size/performance trade. WrapClamp contributes only 4.4% of extra gzip, so its smaller speedup is not
a meaningful size problem. LineClamp remains intermediate.

The balancing point is therefore the 19.340 kB all-component consumer bundle, not another broad
feature deletion. Keep the guarded Rich predictors, identity-preserving patch paths, measured
fallback, and cross-origin-safe local computed-style inspection; let tree shaking exclude Rich from
consumers that do not import it. Further Rich size work needs a new representation or browser
observable that reduces both code and held-out browser work.
