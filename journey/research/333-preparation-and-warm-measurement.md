# Integrating preparation, growth and warm Rich measurement

> Subsequent decision: the dedicated Han/punctuation shortcut described below was removed. The
> small ASCII fast path remains because numeric bounds suffice without a Unicode lookup table;
> other text uses `Intl.Segmenter`. Preparation pooling, Wrap growth probing and warm Rich batching
> remain. Timings below describe the historical combination, not the retained implementation.

## Decision

The four retained routes from [research 332](./332-further-performance-exploration.md) are now
implemented: the closed one-unit grapheme alphabet, a four-entry preparation pool, upper-endpoint
probing during geometric Wrap growth, and warm single-text-node Rich batching.

The public API and native/predictive selection rules are unchanged. DOM measurements remain
authoritative. The conditional Typed OM width rule and high-limit line-fit experiment remain
unintegrated; this work does not establish their broader CSS eligibility.

## Retained constraints

- The grapheme shortcut accepts the entire source only if every character belongs to the known
  ASCII/BMP-Han/punctuation alphabet documented in research 332. Word segmentation remains native.
  Combining marks, variation selectors, astral characters, CRLF and other unadmitted input retain
  native grapheme iteration. Both eager and deferred paths are compared with native boundaries.
- Shared Line/Inline preparation uses an MRU array capped at four exact source/boundary entries
  and **8,192 combined UTF-16 source units**. Oversized input clears it. Cache lookup never shares
  DOM, typography, search hints or measured answers. Unit coverage checks reuse, recency eviction,
  combined capacity, exact-capacity input and oversized invalidation.
- Wrap tests the upper endpoint only after its initial frontier. Failure excludes that measured
  endpoint and resumes the existing binary search. The chunk still restores display mutations,
  renders live slots and verifies current items and the before-affix box. Dense-list browser tests
  compare against independently expanded DOM for both line-count and height limits, including
  full expansion, an overflowing endpoint, irregular widths and shrink/regrow transitions.
- Rich broadens batching only from a previously clamped state whose source is one text node.
  Nonempty markers, explicit widths and current-state guards still apply. Markup retains the older
  same-leaf restrictions. A full-candidate read refreshes visible-position data; result completion
  commits visible content and starts status settlement before Vue leaves its post-flush phase.
  The commit helper returns the existing settlement promise directly.

The Rich browser regression compares four eligible measured peers with a physically identical
serial sibling whose width is intrinsic. It checks source/text/slot snapshots after `nextTick`,
then settled full/clamped states and warm resize transitions. This preserves the existing serial
settlement contract, including consecutive source changes, without assuming all pending observer
or recompute work always finishes in one tick. Existing font, topology, affix and mixed-batch tests
continue to cover the remaining gates.

## Resolving the Rich heap observation

Research 332 observed about 24 KB more incremental `JSHeapUsedSize` for 20 plain Rich instances.
A follow-up isolated the Rich patch, comparing it with the same baseline and duplicate baseline.
After a warmup, forced-GC empty and mounted heap snapshots were captured at 20 instances / six
source updates and 80 instances / 18 updates. Sources contain 6,000 distinct UTF-16 units per instance.

Heap node self-size accounting separates live object ownership from compiled code and native
representation. It is a different metric from total CDP `JSHeapUsedSize`:

| Mounted minus empty snapshot      |  Baseline | Rich candidate | Duplicate baseline |
| --------------------------------- | --------: | -------------: | -----------------: |
| 20 instances: closure count       |     3,118 |          3,118 |              3,118 |
| 20 instances: scope-context bytes |    40,300 |         40,300 |             40,300 |
| 20 instances: array bytes         |   659,768 |        659,640 |            659,768 |
| 20 instances: code bytes          |    63,124 |        101,964 |             34,756 |
| 80 instances: closure count       |    12,418 |         12,418 |             12,418 |
| 80 instances: scope-context bytes |   160,780 |        160,780 |            160,780 |
| 80 instances: array bytes         | 2,732,148 |      2,732,020 |          2,732,148 |
| 80 instances: code bytes          |    84,852 |         83,600 |             93,152 |

The larger 20-instance candidate allocation primarily falls in V8 instruction/compiled-code
nodes. It does not scale into additional retained closures, contexts or text-index arrays at 80
instances. String storage also moves between JavaScript and native representations in the larger
run. This resolves the observed increase sufficiently to retain the guarded Rich change; it is
not a claim that browser memory is identical under every workload or that total heap improved.
There is no added persistent Rich tree, result cache or preparation ownership in this patch.

[Heap evidence](./333-evidence/heap-summary.json) preserves node counts and self-size deltas.
[The snapshot patch](./333-evidence/heap-snapshot.patch) applies to the baseline measurement driver
in an isolated checkout. Run `--heap`, `VUE_CLAMP_UPDATE_ROUNDS=1`, scenario
`source-rich-plain-large-distinct`, and the count/step combinations above. The driver warms up,
then saves round-zero empty/mounted snapshots in its result directory. Compare the standalone
research-332 `rich-warm.patch` build with `d826aa5`; this attribution run isolates Rich from the
other three changes. Snapshots are local diagnostic files, not tracked browser-state dumps.

## Final implementation comparison

Eight measured rounds after one warmup, with 20 instances and 12 updates per sample (four instances
for Wrap), gave the following native Chromium task-duration medians. These include output capture
and browser task activity; they are not isolated CPU or frame-rate claims. Paired log-ratio intervals
use the same 10,000-resample method as research 332.

| Fixture                                              | Baseline ms | Implementation ms | Paired change, 95% interval |
| ---------------------------------------------------- | ----------: | ----------------: | --------------------------: |
| Line, distinct 6,000-unit CJK                        |      912.67 |            835.21 |        −8.6% [−9.2%, −8.2%] |
| Line, four repeated 1,500-unit CJK sources           |      300.49 |            250.29 |     −16.4% [−17.0%, −15.9%] |
| Inline, four repeated 1,500-unit emoji/mixed sources |      272.09 |            256.40 |        −5.5% [−6.2%, −4.8%] |
| Rich, distinct 6,000-unit CJK                        |    1,020.08 |            939.88 |        −8.2% [−8.9%, −7.4%] |
| Rich, one text node, synthetic font-metric change    |       83.79 |             72.61 |      −13.8% [−21.4%, −6.2%] |
| Rich, one text node, width changes                   |       55.69 |             48.94 |      −13.1% [−17.1%, −8.8%] |
| Wrap, 1,000 small items, height-limited width jumps  |      657.30 |            523.59 |     −20.0% [−20.6%, −19.3%] |

Distinct 6,000-unit emoji/mixed Inline sources were neutral: 860.85 → 863.32 ms, paired +0.15%
[−0.41%, +0.66%]. Short Line sources were also inconclusive at −0.7% [−4.3%, +3.1%]. Duplicate-baseline
controls are preserved alongside the candidate in [measurement samples](./333-evidence/measurements.json).
Repeated-source gains require cache reuse; these percentages must not be generalized to all inputs.

Trusted native font-load comparisons at 20 instances, four events and four measured rounds also
matched exact output. Plain Rich task medians were 33.77 → 24.71 ms, and plain Rich with an affix
31.30 → 28.55 ms. The no-affix duplicate baseline shifted by −6.9%, so the exact magnitude should
not be generalized. Styled Rich, Line and Inline controls did not establish a font-load gain.

Nine actual component scenarios at one and four instances match baseline and duplicate-baseline
markup in Firefox 153.0 and WebKit 26.5. The 512-source Unicode corpus matches in 2,048 comparisons
per engine on Chromium 149.0.7827.55, Firefox and WebKit. These are behavior checks, not cross-engine
speed claims.

Consumer size is unchanged from the combined prototype: all root exports increase from 26,275 to
26,618 gzip bytes (+343), with Vue external and esbuild minification through Vite. Separate import
increments are +205 bytes for Line, +184 for Inline, +144 for Rich and +29 for Wrap. Gzip level is 9;
these component increments do not sum because shared bundling and compression differ.

The baseline built-JS fingerprint is
`7b469ec41718f04db1c64021db1725fdfb5526a08adb5f8b51e171803890aa53`; the final implementation is
`824700d8726c8847ecbc3c6e579b027d8b7e21d42f287cc680ae4e0f39769a8c`. The hash covers sorted JS filenames
and contents, excluding maps and declarations. Reproduction uses the same drivers and fixture
patches as research 332, substituting the final built package for its candidate.

The final implementation also passes 90 unit tests, 342 browser tests, the type/lint/format gate,
and the library/website production build. Research 332 already screened all 152 public scenarios
for the same four runtime mechanisms; its two-sample matrix is an execution screen, not a precise
performance estimate. Final built-package comparisons use the production Vue driver, rotating
baseline/candidate/duplicate-baseline order and checking exact settled markup after every update.
