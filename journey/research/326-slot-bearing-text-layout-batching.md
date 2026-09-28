# Slot-bearing text layout batching

## Decision

Extend research 325's measured Line batching to live `before` / `after` slots, initial search, and
source replacement. Slot presence alone does not make a text candidate structural: each search
changes the existing body text while keeping its current slot DOM. Slot rendering and subsequent
reclamps still use the normal Vue lifecycle. No slot output or final answer is cached across inputs.

The baseline is the completed research 325 implementation, including its earlier batching gains.
These are incremental measurements against that local baseline, not against published 1.6.0.
The measured root entry hashes start with `2e0a97076999edc4` (baseline) and `42533466b13f271d`
(candidate).

## Runtime boundaries and costs

- Standard measured Line instances now share resize delivery even when they have slots or currently
  expose the full source. Native and predictive paths retain independent observation.
- Cold and source-reset searches can join a batch. A previous full-fit result retains its serial
  path, including its cheap grow reuse. Single measured instances bypass the batch entry point.
- Nonempty ellipses and explicit inline width evidence remain required. The intrinsic-width and
  empty-marker restrictions from research 325 remain; Rich and Wrap candidates remain synchronous.
- A queued Line search checks its original root, text, prepared source, limits, marker, location,
  and before/after element identities before advancing or committing. Slot appearance, removal,
  root replacement, and expansion continue to invalidate obsolete work.
- Batched `maxHeight` candidates refresh the root's viewport position every round. Earlier siblings
  can change height between rounds, moving later roots even when their own height is unchanged.
  Keeping the old top coordinate caused real fit failures in mixed line/height batches. Border and
  height caching remain, but the additional bounding reads are included in the measurements below.
- A completed batch commits reactive state during Vue's post-flush phase. Vue's recursive render
  pass settles that commit before the measurement promise resumes. Awaiting its state-settlement
  promise a second time delayed queued source replacements; removing that extra await restored the
  production fixture's consecutive long/short text and accessibility output.

This extends text batching without imposing containment or changing consumer slot semantics.
Explicit widths and stable candidate structure remain a practical eligibility boundary, not proof
of isolation under every possible stylesheet or content-dependent size constraint.

## Browser evidence

Five added browser cases cover twelve neighboring instances with mixed `maxLines` / `maxHeight`,
word boundaries, varied source lengths, before tags, and buttons whose width and presence depend on
`clamped`. They cover initial mounting, shrinking/growing, affix resize/removal/reappearance, source
replacement, font changes, root replacement, and expansion/collapse. Cold mount, conditional source
updates, and external CSS resize are also checked at the following animation-frame callback.
Visible output is captured before an exhaustive current-font candidate oracle runs; truncated states
also verify the hidden accessible source. All 319 browser cases and 81 unit cases pass, along with
format/lint/type checks and package plus website production builds.

Two baseline limitations were separated from batching regressions:

- A fixed three-`nextTick` budget does not generally settle state-dependent slot geometry, including
  in the baseline. The production cold-mount measurement drains microtasks through a browser task
  in both versions; frame-based E2E checks cover visible settlement. The source-replacement fixture
  retains its three-tick differential check. No universal tick-count guarantee is introduced.
- At 140px with 19px Arial, a 48px height budget and 68px after button, word-to-grapheme fallback is
  nonmonotonic: ranks 0–9 fit, 10–12 fail, and 13–17 fit after a new word break appears. Both baseline
  and candidate return `Operation…`, while exhaustive search allows `Operational dashb…`. This is
  an existing fallback-search limitation, not fixed by batching. The font-transition regression
  uses 220px and does not claim universal maximality across fonts and line-breaking geometry.

## Production timing

The reusable `measure-layout-batches.mjs` fixture uses production Vue and package builds, rotates
baseline/candidate/A/A order, verifies output after every update, and retains individual rounds.
Timing runs have no DOM spies or Chrome Performance metrics. The following results use Chromium
149.0.7827.55, sixteen components, twelve width/source transitions (or twelve complete mounts), and
eight paired rounds. Values are milliseconds for the whole run. Intervals are paired Student t
95% intervals normalized by the baseline mean; percent changes need not equal median ratios.

Cold rows time unmount/remount and all subsequent microtasks. A `MessageChannel` task includes slot
settlement without adding an animation-frame wait or assuming a fixed count of Vue flushes. Both
entries use the same timing boundary and output comparison. Other Vue rows retain three ticks;
external rows time resize delivery and Vue settlement, with the independent frame regression
covering visible output.

| Workload                           | Baseline median | Candidate median | Paired change |     95% interval | A/A change |
| ---------------------------------- | --------------: | ---------------: | ------------: | ---------------: | ---------: |
| After button / resize              |           24.05 |            16.10 |        -33.6% | -38.0% to -29.2% |      +5.0% |
| Before + after / resize            |           24.00 |            15.95 |        -32.9% | -34.6% to -31.1% |      +0.9% |
| Height limit + slots / resize      |           23.60 |            15.85 |        -33.4% | -36.0% to -30.9% |      +0.3% |
| Dynamic after width / resize       |           31.20 |            20.55 |        -33.7% | -35.7% to -31.8% |      +1.0% |
| Source replacement + after         |           29.95 |            22.20 |        -25.7% | -29.0% to -22.4% |       0.0% |
| After button / external CSS resize |           42.15 |            30.50 |        -30.3% | -35.1% to -25.5% |      -1.4% |
| Source replacement, no slots       |           26.10 |            19.40 |        -25.4% | -27.4% to -23.3% |      +0.3% |
| Cold mount + after                 |           82.45 |            55.50 |        -33.6% | -38.1% to -29.0% |      -3.3% |
| Cold mount, no slots               |           48.25 |            40.55 |        -17.0% | -20.1% to -13.9% |      +1.5% |
| Full-fit control                   |            7.50 |             7.45 |         -2.2% |   -5.5% to +1.2% |      -2.2% |
| Native single-line affix control   |            5.70 |             5.85 |         +7.3% |  -3.5% to +18.1% |      +4.3% |

The same eleven workloads were measured with one component. All paired intervals cross zero;
short runs and substantial A/A variation establish neither a singleton gain nor exact neutrality.
The measured benefit is multi-instance throughput. Native/full-fit control intervals also cross
zero. These percentages describe this fixture, not every resize trajectory or font.

A separate three-round run uses Chrome's native Performance domain. Median browser layout counts
and layout durations confirm that fewer layout flushes accompany the elapsed-time improvements:

| Workload                                | Layout count, baseline → candidate | Layout duration, baseline → candidate |
| --------------------------------------- | ---------------------------------: | ------------------------------------: |
| After / before + after / height + slots |                           780 → 60 |           16.43–17.10ms → 9.25–9.52ms |
| Dynamic after width                     |                          1026 → 76 |                     22.64ms → 13.06ms |
| Source replacement + after              |                           806 → 66 |                     20.11ms → 11.42ms |
| After / external CSS resize             |                           780 → 60 |                     28.90ms → 18.91ms |
| Source replacement, no slots            |                           666 → 64 |                      16.45ms → 9.99ms |
| Cold mount + after                      |                         2165 → 279 |                     50.94ms → 30.32ms |
| Cold mount, no slots                    |                          871 → 223 |                     28.44ms → 21.49ms |
| Full-fit / native controls              |                            12 → 12 |             No layout-count reduction |

Geometry getter counts are a different measure: refreshing each height candidate's root position
adds reads while still reducing the number of browser layout flushes.

## Public workload counters

The existing public package matrix passed twelve selected Line scenarios for both entries with
three samples each: native titles, continuous/jitter/novel/jump CTA resizing, external CSS resizing,
long-word fallback, plain/word/affixed height limits, and source updates. These instrumented runs
establish work counts; their timings are not used for the throughput percentages above.

| Public workload         | Bounding reads, baseline → candidate | Mutations, baseline → candidate |
| ----------------------- | -----------------------------------: | ------------------------------: |
| CTA continuous          |                        15168 → 14976 |                   12187 → 12139 |
| CTA novel jitter        |                          5584 → 4816 |                     4187 → 3995 |
| CTA jumps               |                          7872 → 5568 |                     5888 → 5312 |
| CTA external jumps      |                          6000 → 4272 |                     4113 → 3681 |
| Grapheme height jumps   |                          5259 → 5334 |                     3969 → 3825 |
| Word height jumps       |                          4128 → 4800 |                     3104 → 3104 |
| Affixed height jumps    |                        26704 → 22025 |                   14354 → 13298 |
| Cold source replacement |                           2136 → 888 |                      1908 → 888 |

Native titles, repeated CTA jitter, and both long-token rows keep their bounding, exact-rect, and
mutation counts. Exact-rect counts also remain unchanged in the other rows. Some height rows pay
more bounding reads to refresh viewport positions; other rows shed redundant follow-up work.
Consumer before/after slot invocation counts remain unchanged in every selected row.

## Delivery cost and reproduction

With Vue external, consumer bundles minified by Vite and gzip level 9, this extension changes Line
from 10,731B to 10,760B (+29B gzip) and Pretext from 30,536B to 30,557B (+21B). Inline, Rich, and Wrap
are byte-identical to research 325. No public API or runtime dependency is added.

Retain a built baseline package before editing, build the candidate, and run from the workspace:

```sh
VUE_CLAMP_BATCH_ROUNDS=8 VUE_CLAMP_BATCH_COUNTS=1,16 \
VUE_CLAMP_BATCH_SCENARIOS=line-affix,line-both,line-height-affix,line-dynamic-affix,line-source-affix,line-affix-external,line-full,line-source,line-cold-affix,line-cold,line-native-affix \
vp exec node tools/benchmark/scripts/measure-layout-batches.mjs /path/to/baseline
```

Repeat with `VUE_CLAMP_BATCH_ROUNDS=3`, `VUE_CLAMP_BATCH_COUNTS=16`, and `--metrics` for the independent
layout-count run. The command prints its JSON artifact path; mismatches preserve expected and
actual output in a diagnostic JSON file.
