# Mixed-component layout batching

## Decision

Extend the measured resize hub across component families, and let eligible warm Rich text-leaf
searches share Line/Inline candidate rounds. Keep structural searches serial. The baseline is the
completed research 326 implementation, including its existing Line/Inline batching, rather than
published 1.6.0. The compared root entry SHA-256 prefixes are `42533466b13f271d` (baseline)
and `fdde6fd3d358db40` (candidate). No public API, containment rule, answer cache, or dependency is added.

Three changes are retained:

- Pretext uses shared measured delivery when its input takes the normal measured fallback. Actual
  prediction and native CSS paths retain independent observers.
- Wrap shares resize delivery so asynchronous Vue count updates start in the same callback. Its
  direct materialized-item search remains serial. Wrap registrations do not count as candidate
  peers, so a single measured text component beside Wrap still bypasses candidate batching.
- Rich shares measured delivery. A warm search can yield only for positive cuts in its original
  existing text leaf, with a nonempty marker, explicit width evidence, unchanged visible/probe state,
  and no required full-candidate verification. Native, full-fit, cold, and source-reset searches stay
  serial. The same width restrictions as research 325 apply to candidate batching.

Rich retains its existing search policy, inspection, and probe order. Its internal generator exposes
candidate writes and reads without changing the synchronous helper's contract. Full-tree preparation
runs before joining the queue. If the search crosses a leaf, changes elements, or requires structural
restoration, it returns a continuation that resumes only after the whole text batch finishes. A
prototype that restored and restarted the search on exit was rejected because it repeated inspection
and mutations. Final restoration is also an explicit yielded operation, preventing a structural write
from being hidden in generator advancement. Batched height checks refresh the root position each round.
Queued Rich work validates prepared content, root/body/probe nodes, limits, active state, and affix
identities before resuming or committing.

This is a bounded extension, not universal CSS isolation. Rich element changes and Wrap item probes
must not be interleaved as independent text candidates. The rejected broad structural batching from
research 324 remains rejected. Explicit widths do not prove independence under every possible
content-dependent CSS constraint.

## Correctness and fixture boundaries

Five additional browser cases cover fifteen mixed roots from Line, Inline, Rich, Wrap, and measured
Pretext fallback. They exercise line/height limits, static and state-dependent slots, font and source
changes, affix appearance/removal, root replacement, expansion, and teardown. External CSS resizing
is checked at the next animation frame. Rich leaf-crossing and Wrap structure changes drive sibling
`:has()` typography, and Wrap intrinsic flex widths are compared with freshly measured single-instance
references. Visible results are captured before mounting those references, avoiding an oracle that
repairs a stale batch. All 324 browser and 81 unit cases pass, as do format/lint/type checks and the
package plus website builds.

Two benchmark details materially affect interpretation:

- An after **button** makes Rich's passive-clone safety gate choose whole-HTML fallback. Rich timing
  fixtures therefore use a passive span; the rejected button fixture did not measure Rich search.
- Wrap width changes can finish after three Vue ticks. The production fixture waits for resize
  delivery and drains microtasks through a MessageChannel task. The clock starts with the assignment
  inside an animation-frame callback, excluding the wait for that frame. Earlier tick-only Wrap
  timings measured stale output and are discarded. Mixed output checks compare complete root HTML,
  including Wrap items and Rich probes, after every transition in both versions.

## Production timing

Production Vue and package builds are compared in Chromium 149.0.7827.55 with rotated baseline,
candidate, and A/A ordering. Timing has no DOM spies or Performance-domain collection. These rows
use fifteen total components, twelve width transitions, and eight paired rounds. Mixed rows contain
three instances of each of the five families; single-family rows contain fifteen of that family.
Medians are milliseconds for the complete run. Paired changes and Student t 95% intervals are
normalized by the baseline mean, so they need not equal median ratios.

| Workload                      | Baseline median | Candidate median | Paired change |     95% interval | A/A change |
| ----------------------------- | --------------: | ---------------: | ------------: | ---------------: | ---------: |
| Rich, prefix + main text leaf |           30.25 |            27.45 |         -7.1% |  -10.1% to -4.1% |      +3.5% |
| Rich, single emphasized leaf  |           27.90 |            23.60 |        -15.4% | -18.3% to -12.4% |      +1.7% |
| Rich, plain HTML text         |           24.20 |            19.60 |        -20.0% | -21.2% to -18.8% |      -0.1% |
| Rich, external CSS resize     |           49.40 |            48.90 |         -1.1% |   -6.6% to +4.5% |      +6.2% |
| Rich, single leaf / external  |           49.20 |            42.35 |        -10.9% |  -18.6% to -3.2% |      +0.2% |
| Wrap                          |           36.80 |            31.70 |        -16.6% | -23.1% to -10.2% |      +4.0% |
| Wrap, external CSS resize     |           49.20 |            42.15 |        -14.6% |  -27.1% to -2.0% |      +0.1% |
| Pretext measured fallback     |           24.60 |            16.95 |        -30.5% | -34.0% to -26.9% |      -0.3% |
| Pretext fallback / external   |           44.65 |            37.95 |        -11.2% |  -23.9% to +1.6% |       0.0% |
| Line after-slot control       |           15.95 |            16.30 |         +1.7% |   -0.8% to +4.3% |      +2.4% |
| Inline split control          |           15.05 |            14.75 |          0.0% |   -3.6% to +3.6% |      +2.1% |
| Rich full-fit control         |           12.20 |            12.20 |         +1.7% |   -5.2% to +8.5% |      -2.1% |
| Rich native control           |            4.45 |             4.70 |         +7.1% |  -3.1% to +17.2% |      +6.8% |
| Five-family mix               |           37.45 |            38.35 |         +3.0% |   -1.3% to +7.3% |      +0.5% |
| Five-family mix / external    |           47.60 |            45.15 |         -7.9% |  -18.6% to +2.9% |      -2.1% |

The all-family mix reduces layout work, but these elapsed-time intervals do not establish a gain.
Single-family improvements do not justify claiming universal mixed-page speedups.

One-component versions of these rows showed substantial short-run variation. Initial intervals were
positive for Rich full-fit (+11.8%), Inline split (+20.4%), and external Pretext fallback (+25.4%).
A follow-up uses twelve paired rounds and four width cycles (48 transitions), including A/A controls:

| One-component confirmation  | Baseline median | Candidate median | Paired change |     95% interval |
| --------------------------- | --------------: | ---------------: | ------------: | ---------------: |
| Rich full-fit               |            4.45 |             4.55 |         -1.6% | -24.3% to +21.2% |
| Rich single leaf            |            7.95 |             8.35 |         +5.1% |  -2.4% to +12.6% |
| Inline split                |            6.75 |             8.40 |        +17.0% | -11.2% to +45.2% |
| Pretext fallback / external |           75.05 |            72.05 |         -6.2% |  -16.3% to +4.0% |
| Wrap                        |           67.10 |            68.80 |         -1.2% |   -9.5% to +7.1% |

The initial singleton regressions were not confirmed. The wide intervals also do not establish
neutrality, particularly for Inline split. The retained claim is multi-instance throughput; these
controls remain a limitation rather than evidence of single-instance improvement.

## Browser layout evidence and cross-family control

A separate three-round Performance-domain run uses twenty components and twelve transitions.
The partitioned control imports five copies of the **same candidate build**, one per family, so
families can batch internally but cannot share a hub. Vue and Pretext's engine remain shared. Output
is compared with both baseline and candidate. Counts below are median browser layout flushes,
not geometry getter calls.

| Workload                       | Baseline | Shared candidate | Partitioned candidate |
| ------------------------------ | -------: | ---------------: | --------------------: |
| Rich, prefix + main leaf       |     1472 |              864 |                   864 |
| Rich, single leaf / plain text |     1332 |              458 |                   458 |
| Wrap                           |      692 |               46 |                    46 |
| Pretext measured fallback      |      972 |               60 |                    60 |
| Rich full-fit                  |      252 |              252 |                   252 |
| Rich native                    |       12 |               12 |                    12 |
| Line + Inline mix              |      111 |              111 |                   157 |
| Line + Inline mix / external   |      126 |              126 |                   172 |
| Five-family mix                |      560 |              337 |                   454 |
| Five-family mix / external     |      786 |              371 |                   490 |

The partitioned comparison isolates a cross-family benefit beyond same-family batching: shared
mixed delivery saves 117–119 additional layouts in this fixture. Mixed layout duration changes
from 20.10ms to 17.44ms (partitioned 18.89ms), and external mixed duration from 27.97ms to 22.85ms
(partitioned 27.27ms). Rich prefix duration changes from 28.41ms to 21.72ms, single-leaf from
25.21ms to 16.49ms, Wrap from 16.92ms to 7.77ms, and measured Pretext from 23.06ms to 11.41ms.
Instrumentation runs establish layout work, not the elapsed-time percentages above.

## Public workload counters

The public package matrix passes 25 selected scenarios with two samples per entry: seventeen Rich
rows covering continuous/jitter/novel/jump resizing, external resizing, nested markup, dynamic atomic
content, full-fit transitions, source replacement, native HTML updates, fonts, long tokens, and
height limits; and eight Wrap rows covering grow/shrink, large item sets, dynamic before/after slots,
and combined limits. Geometry reads, client-rect entries, DOM mutation counts, clone calls, style
reads, and consumer before/after/item slot invocations remain unchanged in every selected row.
Representative equal counts per run are:

| Workload                    | Bounding reads | Client-rect entries | DOM mutations | Consumer slot calls                      |
| --------------------------- | -------------: | ------------------: | ------------: | ---------------------------------------- |
| Rich metadata continuous    |          8,800 |              12,768 |        34,144 | 1,760 before + 1,760 after               |
| Rich dynamic atomic jumps   |          2,576 |               4,768 |         7,986 | None                                     |
| Rich height + affixes       |          6,720 |                   0 |        10,656 | 576 before + 576 after                   |
| Wrap dynamic before         |         16,300 |                   0 |         8,300 | 1,200 before + 14,200 item               |
| Wrap dynamic after          |         17,100 |                   0 |         8,200 | 1,600 before + 1,600 after + 17,500 item |
| Wrap tiny items / wide grow |         14,320 |                   0 |         8,840 | 23,680 item                              |

Shared delivery changes observer-callback grouping, and yielding can split MutationObserver
notifications without changing mutation records. Neither callback grouping nor the instrumented
matrix's elapsed time is used as evidence for the production throughput percentages above.

## Delivery cost

Consumer bundles minified by Vite, with Vue external and gzip level 9, change as follows:

| Import  | Baseline gzip | Candidate gzip | Increase |
| ------- | ------------: | -------------: | -------: |
| Line    |       10,760B |        10,773B |      13B |
| Inline  |        6,155B |         6,171B |      16B |
| Rich    |       13,393B |        14,848B |   1,455B |
| Wrap    |        5,560B |         5,795B |     235B |
| Pretext |       30,557B |        30,564B |       7B |

Rich's continuation machinery is the principal delivery trade-off: approximately 1.46kB gzip for
7–20% lower elapsed time in the eligible fifteen-instance Vue-driven fixtures. It does not make
structural or cold Rich work faster. Wrap pays for shared dispatch; root consumers still exclude
Pretext's engine. Shared observation is retained here because it enables cooperative work, not as
an optimization by itself.

## Reproduction

Retain a built research 326 package, build the candidate, and use the production fixture:

```sh
VUE_CLAMP_BATCH_COUNTS=1,15 VUE_CLAMP_BATCH_ROUNDS=8 \
VUE_CLAMP_BATCH_SCENARIOS=rich,rich-leaf,rich-text,wrap,pretext-fallback,mixed-all,mixed-all-external \
vp exec node tools/benchmark/scripts/measure-layout-batches.mjs /path/to/baseline
```

Run layout collection separately with `--metrics --partitioned`, twenty components, and three
rounds. Use `VUE_CLAMP_BATCH_CYCLES=4` and twelve rounds for the longer singleton control. The fixture
retains browser version, build paths, cycle/partition metadata, every rotated round, and output
comparisons. No instrumentation timings should be combined with uninstrumented throughput rows.
