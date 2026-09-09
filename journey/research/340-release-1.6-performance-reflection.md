# Performance reflection against published 1.6.0

## What this release comparison establishes

The gains concentrate in cohorts that require browser measurement. Default native CSS paths
already existed in 1.6.0 and show no reliable general resize improvement here. Most singleton
results are inconclusive. Therefore the release should be described through specific measured
workloads, not a universal percentage improvement for every clamp.

The baseline is the [published npm 1.6.0 package](https://www.npmjs.com/package/vue-clamp/v/1.6.0), published on
2026-08-21; the measured candidate is the frozen working-tree snapshot with JS fingerprint
`8beb9ee`. “Current” in the tables refers to that snapshot; later behavior-preserving code
cleanup is not included in these timing or size measurements.
[Research 339](339-information-first-resize-search.md) uses an internal `c764480` baseline, and
[research 322](322-release-1.6-performance-comparison.md) used an earlier candidate. Neither set
of percentages is a substitute for this release-to-current comparison.

## Start with application work

Every new instance must mount. Resize becomes repetitive in resizable panels, responsive lists
and transitions; text replacement matters in refreshed or recycled content. A font completion
can affect every active instance near initial rendering, but twelve synthetic notifications do
not establish its frequency in a real application. We have no production distribution that
justifies weighting these events into one overall speedup.

For a fixed cohort and comparable content, an application can estimate active-work savings from
its observed mount, resize, source-update and font-event counts multiplied by the corresponding
per-operation differences below. These estimates should remain separate from download/parse
costs, and cannot establish frame latency or FPS. A page that mounts once and never resizes
cannot use the resize percentage as its page-load gain.

The default Line, Rich and unsplit end Inline paths can use native CSS. Word boundaries,
trailing multiline actions, middle Inline placement and splitting can require measurement.
Explicit width contracts also determine eligibility for cooperative text measurement. Ordinary
external Rich here sits inside an auto-width article and is ineligible for that batching path;
its improvements must not be attributed to batching. The explicit Vue-width Rich control
exercises a different layout contract.

## Resize and content replacement: 12 instances

The task column is the median **cohort task work per update**, in milliseconds: a twelve-update
sample divided by twelve. Layout counts are the complete twelve-update sample. Relative changes
use paired geometric ratios, so their percentages need not equal the ratio of the two medians.
Negative task changes mean less browser work. “Unresolved” means the two release comparisons do
not both exclude zero in the same direction; it does not establish no change.

| Workload                                   | Task ms: 1.6.0 → current | Paired task change [95% interval] | Layouts per sample | Reading                               |
| ------------------------------------------ | -----------------------: | --------------------------------: | -----------------: | ------------------------------------- |
| Default/native Line                        |            2.129 → 2.155 |               +3.6% [-4.1, +12.7] |            12 → 12 | Unresolved                            |
| Default/native Inline                      |            1.013 → 1.019 |              +4.9% [-15.0, +27.1] |            12 → 12 | Unresolved                            |
| Word-boundary Line, explicit width         |            3.648 → 2.856 |             -21.9% [-31.9, -12.2] |           872 → 77 | Reduction against both release copies |
| Chinese word-boundary Line, explicit width |            5.158 → 2.575 |             -51.4% [-54.4, -48.6] |          1078 → 69 | Reduction against both release copies |
| Line with trailing button, explicit width  |            3.262 → 2.076 |             -38.0% [-44.9, -30.3] |           844 → 81 | Reduction against both release copies |
| Middle Inline, explicit width              |            2.557 → 1.749 |             -31.5% [-39.4, -22.1] |         1003 → 110 | Reduction against both release copies |
| Split path Inline, explicit width          |            2.801 → 2.010 |             -28.8% [-36.3, -23.2] |          995 → 125 | Reduction against both release copies |
| Distinct moderate Line text replacement    |            4.170 → 3.161 |             -24.2% [-28.4, -19.1] |          894 → 108 | Reduction against both release copies |
| Distinct moderate Inline text replacement  |            3.828 → 3.440 |              -14.5% [-25.1, -5.9] |          936 → 156 | Reduction against both release copies |
| Default/native Rich                        |            1.619 → 1.373 |              -2.1% [-15.7, +11.2] |            12 → 12 | Unresolved                            |
| Nested word-boundary Rich, ordinary parent |            4.695 → 3.994 |             -14.8% [-18.3, -12.2] |         1244 → 944 | Reduction against both release copies |
| Nested Rich with trailing link             |            4.743 → 3.991 |              -13.2% [-16.9, -9.4] |         1192 → 952 | Reduction against both release copies |
| Nested Rich, Vue pixel-width control       |            4.802 → 3.914 |             -17.0% [-20.0, -14.0] |         1244 → 721 | Reduction against both release copies |
| Visible Rich title replacement             |            6.439 → 6.323 |                -2.3% [-4.4, -0.2] |        1083 → 1083 | Reduction against both release copies |
| Two-row varied labels                      |            3.450 → 2.974 |              -12.3% [-19.2, -4.8] |          264 → 116 | Unresolved                            |
| Two-row labels with dynamic +N             |            4.183 → 3.326 |             -20.2% [-22.8, -17.2] |           484 → 63 | Reduction against both release copies |
| Varied labels, pure 72 px height limit     |            3.456 → 3.557 |                -0.3% [-7.4, +6.8] |          366 → 206 | Unresolved                            |
| Two-row labels with leading control        |            3.559 → 3.264 |               -7.1% [-14.0, +0.3] |          328 → 115 | Unresolved                            |
| Labels, Vue pixel-width control            |            3.800 → 3.523 |               -3.9% [-10.7, +3.2] |          264 → 116 | Unresolved                            |

The most useful observed differences are approximately 0.8–1.2 ms per update for explicit-width
measured Line/Inline, 2.6 ms for the Chinese Line fixture, and 0.7–0.9 ms for nested Rich and
labels with a dynamic overflow indicator. These are component-cohort task costs on this host,
not whole-page response times.

The controls materially change interpretation. Plain two-row Wrap appears 12.3% faster against
the first release copy, but A/A drift is −10.4%; against the second release copy its interval
crosses zero. The dynamic +N Wrap case remains faster against both copies, with estimates of
20.2% and 13.2% respectively. Pure-height Wrap reduces layouts from 366 to 206 without establishing
a task-time improvement. Moderate visible Rich-title replacement has only a small roughly 2–3%
observed reduction; the large-source stress gains in earlier research should not represent it.

### Ordinary auto-width text controls

Changing only the component declaration to `width:auto` keeps the same physical widths and
content while disabling the explicit-width text batching contract. The held-out results are:

| Workload, 12 instances                | Task ms: 1.6.0 → current | Paired task change [95% interval] | Layouts / 12 updates | Reading                       |
| ------------------------------------- | -----------------------: | --------------------------------: | -------------------: | ----------------------------- |
| Word-boundary Line, auto width        |            3.535 → 2.917 |             -16.0% [-20.7, -10.1] |            872 → 498 | Reduction against both copies |
| Line with trailing button, auto width |            3.476 → 2.868 |             -16.9% [-23.0, -10.5] |            844 → 500 | Reduction against both copies |
| Middle Inline, auto width             |            3.038 → 3.219 |               -2.3% [-12.6, +9.5] |           1003 → 714 | Unresolved                    |

Measured Line still improves by roughly 16–17% against the first release copy at auto width,
with negative intervals against the duplicate as well. The middle Inline gain is not established
at auto width, despite fewer layouts. Its explicit-width −31.5% result therefore cannot be
generalized to ordinary auto-width Inline. These separately sampled rows establish conditional
release outcomes; subtracting their percentages does not quantify an isolated batching benefit.

## Fresh-content settled mounts: 12 instances

These are whole-cohort mount costs. Modules and fonts are already warm; fresh per-round text/HTML
forces preparation of new content, with identical content for all three targets in a pair.
Fixture construction and `createApp` occur outside the interval; `app.mount`, component preparation
and initial settlement occur inside. This measures neither module parsing nor first-page navigation.

| Workload                                   | Task ms: 1.6.0 → current | Paired task change [95% interval] | Layouts per sample | Reading                               |
| ------------------------------------------ | -----------------------: | --------------------------------: | -----------------: | ------------------------------------- |
| Default/native Line                        |            2.346 → 2.336 |              -10.6% [-28.7, +4.6] |              1 → 1 | Unresolved                            |
| Default/native Inline                      |            1.643 → 1.569 |              -5.7% [-18.4, +11.1] |              1 → 1 | Unresolved                            |
| Word-boundary Line, explicit width         |            6.713 → 5.603 |             -21.0% [-30.2, -14.2] |           122 → 22 | Reduction against both release copies |
| Line with trailing button, explicit width  |            7.367 → 6.708 |              -13.2% [-26.3, -1.7] |           119 → 23 | Reduction against both release copies |
| Middle Inline, explicit width              |            4.004 → 3.016 |             -27.8% [-31.1, -24.2] |           103 → 11 | Reduction against both release copies |
| Default/native Rich                        |            3.418 → 2.686 |              -1.7% [-30.2, +45.7] |              1 → 1 | Unresolved                            |
| Nested word-boundary Rich, ordinary parent |           11.852 → 9.642 |              -16.4% [-24.7, -5.3] |          205 → 157 | Unresolved                            |
| Nested Rich with trailing link             |          12.456 → 13.196 |              +5.1% [-11.5, +21.3] |          223 → 223 | Unresolved                            |
| Two-row labels with dynamic +N             |            7.710 → 7.533 |              +5.1% [-13.6, +29.2] |              8 → 5 | Unresolved                            |
| Varied labels, pure 72 px height limit     |            6.348 → 5.966 |               -0.5% [-8.2, +11.9] |              6 → 4 | Unresolved                            |

Measured Line and middle Inline cohorts show useful mount reductions. A general native-path or
Wrap mount gain is not established. Rich's unadorned mount point estimate is lower, but its
comparison with the duplicate release crosses zero; the trailing-link mount remains unresolved.
No first-navigation or cold-download benefit is implied.

## Singletons and rare notifications

The one-instance runs have mostly wide intervals and do not establish a general singleton gain. The Chinese measured-Line
resize case is a clear exception: 2.090 → 1.633 ms per update, a paired −21.0% interval of
[−26.2%, −13.6%], with a negative comparison to the second release copy as well. Some singleton
point estimates increase; this is not evidence that all small workloads are free of regressions.
For example, source Inline's +34.2% estimate is accompanied by +33.2% A/A drift, so it cannot be
assigned to the candidate from that run.

Each following sample contains **one** synthetic unchanged-font `loadingdone` notification,
not a real font download. Task milliseconds cover the 12-instance cohort:

| Workload                               | Task ms: 1.6.0 → current | Paired task change [95% interval] | Layouts per sample | Reading                               |
| -------------------------------------- | -----------------------: | --------------------------------: | -----------------: | ------------------------------------- |
| Measured Line, one font notification   |            2.227 → 1.861 |             -21.8% [-33.0, -11.7] |             36 → 3 | Reduction against both release copies |
| Measured Inline, one font notification |            2.062 → 2.006 |               -5.9% [-12.3, +1.4] |            60 → 12 | Unresolved                            |

Line saves about 0.37 ms per such notification in this fixture. Inline has no established change
against both copies. The earlier +15.5% Inline notification cost was relative to the internal
optimization baseline, not the published 1.6.0 upgrade. Since font delivery is typically much less
repetitive than a resize sweep, its synthetic stress percentage should not receive the same
weight as repeated resizing. Exact event rates remain application data, not a benchmark assumption.
Actual font-resource changes remain correctness work covered by research 339.

## Delivery cost

Identical production bundling with Vue external and gzip level 9 gives:

| Import              | 1.6.0 gzip bytes | Current gzip bytes |       Increase |
| ------------------- | ---------------: | -----------------: | -------------: |
| All four components |           22,298 |             26,666 | 4,368 (+19.6%) |
| LineClamp           |            9,093 |             11,389 | 2,296 (+25.3%) |
| InlineClamp         |            5,350 |              7,408 | 2,058 (+38.5%) |
| RichLineClamp       |           13,138 |             15,394 | 2,256 (+17.2%) |
| WrapClamp           |            5,434 |              6,234 |   800 (+14.7%) |

Most growth predates research 339: the release-to-internal-baseline increase is 4,217 bytes, and
the final optimization stage adds another 151 bytes to the all-components import. Whole-release
changes include cooperative measurement, shared resize delivery, preparation/font scheduling,
shared predictor integration, and correctness handling for shaping, typography invalidation and
full-text recovery. Source inspection cannot allocate exact compressed bytes by feature. Do not
sum tree-shaken component sizes.

`vue-clamp/pretext` is a separate opt-in import: 31,154 gzip bytes including its engine dependency,
with Vue external. It has no 1.6.0 subpath counterpart, and its performance is not an automatic
root-import upgrade gain. Root imports exclude the Pretext engine, while shared Line runtime
still includes predictor integration code. Released-version persistent-memory changes were not
remeasured here; earlier internal-baseline heap samples establish no release memory gain.

For a mostly static page using native paths, the larger payload is an established cost while a
runtime gain is not established by these tests. For repeatedly resized measured lists, the cohort
savings are concrete. Release messaging and further optimization should follow those different
uses; fewer probes alone, rare-event stress scores, and one summed benchmark score cannot decide
application value.

## Method and limits

All targets use production Vue and the same headless Chromium on an Apple M3 Max, with a
1280 × 900 viewport on macOS 26.4.1. The A/A target is an
independent module copy of exactly the release bytes, preventing shared preparation state between
release copies. Targets rotate within each round. Browser jobs run serially, without concurrent
builds, tests or bootstrap summarization.

Update rows have one excluded warmup and eight paired rounds of twelve changes at one and twelve
instances. Mount rows use one excluded warmup and six rounds. Font diagnostics have twelve paired
rounds, one event per sample. External text widths sweep 180–360 px; Rich/Wrap outer widths sweep
280–620 px, with the Wrap cell 104 px narrower. Text is roughly 400–470 characters per instance;
Rich uses modest nested article copy, and Wrap uses 24 varied labels. These synthetic fixtures
represent particular application patterns, not observed production traffic.

Native CDP `TaskDuration` includes renderer work through Vue/task and two-frame observer settlement.
It already includes layout; do not add `LayoutDuration` again. Collection ends before all DOM
serialization, fit/style inspection and eight extra quiet frames. Deliberate wall waits are not
paint or interaction latency. Per-update task averages are not per-frame p95, and dividing a
cohort cost by its size gives amortized throughput, not measured singleton latency.

Separate correctness validation covers 1,716 mount/update
checkpoints: 1,482 in the main scenarios and 234 in the auto-width controls. All match release/candidate/control visible output and
fresh mounts, pass route/containment checks, and remain stable for eight additional frames. Every
timed final state is audited again outside its timer. These black-box checks are not exhaustive
maximal-prefix proofs. The hidden accessible full-source node was not independently read.
Native ResizeObserver loop warnings occur; non-RO browser errors are zero.

The comparison contains 1,560 timed samples across six runs and includes duplicate-release
controls. Intervals use 10,000
paired bootstrap resamples, seed 340 per run, on the geometric task ratio. They are descriptive
95% intervals, without multiple-comparison correction. There is no aggregate application speedup
or universal speed claim. Raw samples and one-off experiment scripts are local artifacts excluded
from Git; this report preserves the measured outcomes, scope and limitations.
