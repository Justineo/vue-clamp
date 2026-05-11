# WrapClamp optimization branch summary

## Purpose

This note summarizes the practical effect of the `feat/1.5` WrapClamp optimization branch for
reviewers. It is intentionally outcome-focused: what changed, where users should feel it, what the
benchmark says, and which tempting paths were deliberately rejected.

## One-screen summary

The branch changes WrapClamp from a mostly linear "render a count, measure, grow/shrink one item"
solver into a guarded multi-path solver:

- shrink paths measure the currently rendered public prefix and jump directly to a fitting count
  when the root gets narrower
- no-`after` grow paths materialize a bounded hidden suffix once, binary-search component-owned item
  shells with direct `display` toggles, then commit and verify the final public DOM
- dynamic `after(hiddenItems)` grow gets only a starting-count hint on large width jumps; live DOM
  settlement remains the final proof
- maxHeight participates in the same no-`after` materialized grow and shrink paths
- all accepted fast paths verify final live DOM before they are allowed to return

The public component contract is unchanged: props, slots, emitted events, exposed methods, DOM parts,
and item ordering stay the same.

## Where the win comes from

The old expensive cases repeatedly invoked user item slots and layout reads while walking the count
frontier. The accepted paths reduce that churn in three ways:

1. Use measured item-shell widths as hints instead of treating every resize as a cold solve.
2. For static-flow cases, render a hidden suffix once and search by mutating already-rendered item
   shells instead of rerendering each candidate through Vue.
3. For count-sensitive `after`, jump closer to the final count only when the width change is large
   enough to justify the hint, then let baseline live-DOM settlement finish.

This means the branch helps most when a resize crosses many items, when many WrapClamp instances are
invalidated together, or when item slots are expensive.

## Headline benchmark wins

Current "after" numbers below are from:

```sh
vp test -c vite.browser.benchmark.config.ts packages/vue-clamp/tests/wrap.browser.benchmark.ts
```

run locally on 2026-05-11. Before numbers are the accepted baselines recorded during the optimization
work and preserved here as the compact audit record.

| Scenario                                |          Item slot calls |               Rect reads |             Median total |
| --------------------------------------- | -----------------------: | -----------------------: | -----------------------: |
| Static before + dynamic after jump grow |  `48100 -> 17500` (-64%) |  `52100 -> 14700` (-72%) | `~500ms -> 196ms` (-61%) |
| No-affix tiny-item wide grow            | `131520 -> 20480` (-84%) | `135760 -> 33280` (-75%) | `~387ms -> 158ms` (-59%) |
| Before-affix grow                       |  `48200 -> 10300` (-79%) |  `47000 -> 26600` (-43%) | `~436ms -> 190ms` (-56%) |
| Before-affix shrink                     |   `12500 -> 6900` (-45%) |   `12800 -> 7600` (-41%) |  `~137ms -> 76ms` (-45%) |
| maxHeight grow                          |   `16700 -> 5800` (-65%) |  `16400 -> 13000` (-21%) | `~208ms -> 132ms` (-37%) |
| maxHeight shrink                        |    `8000 -> 4200` (-48%) |    `7500 -> 5000` (-33%) |  `~115ms -> 65ms` (-43%) |
| No-affix hidden grow                    |  `42300 -> 22300` (-47%) |  `39000 -> 23000` (-41%) | `~330ms -> 222ms` (-33%) |
| No-affix large-N                        |   `13360 -> 5360` (-60%) |   `12720 -> 7120` (-44%) |   `~80ms -> 54ms` (-32%) |
| Table width churn                       |  `15200 -> 12200` (-20%) |   `10000 -> 5800` (-42%) | `~215ms -> 165ms` (-23%) |

Interpretation:

- The biggest wins are not small micro-optimizations. They remove whole classes of candidate
  rerenders and repeated measurements.
- The elapsed-time reductions track the slot-call reductions. The heavy-item-slot benchmark keeps
  the same counters as normal hidden grow, but median time rises from about `222ms` to `304ms`,
  confirming that fewer user slot calls matter when real item rendering is expensive.
- Dynamic-after gradual width sweeps intentionally do not get a speculative path; prototypes raised
  rect reads without reducing slot calls.

## Current benchmark shape

Latest local benchmark medians from the current branch state:

| Scenario                           |  Item | Before | After |  Rect |   Total |
| ---------------------------------- | ----: | -----: | ----: | ----: | ------: |
| `single-line-width-sweep`          |    68 |     52 |    52 |   140 | 129.5ms |
| `table-demo-width-sweep`           | 15300 |      0 |  3000 | 14400 | 313.1ms |
| `table-demo-width-churn`           | 12200 |      0 |  2600 |  5800 | 165.0ms |
| `no-affix-jump-grow`               |  6600 |      0 |     0 |  5400 | 116.4ms |
| `no-affix-shrink`                  |  3700 |      0 |     0 |  3800 |  82.5ms |
| `no-affix-hidden-grow`             | 22300 |      0 |     0 | 23000 | 222.1ms |
| `no-affix-large-n`                 |  5360 |      0 |     0 |  7120 |  54.2ms |
| `no-affix-narrow-item-grow`        | 11280 |      0 |     0 | 14760 |  98.8ms |
| `no-affix-wide-item-grow`          |  5160 |      0 |     0 |  6060 |  60.7ms |
| `no-affix-wide-container-grow`     | 11640 |      0 |     0 | 15480 | 108.1ms |
| `no-affix-tiny-item-wide-grow`     | 20480 |      0 |     0 | 33280 | 158.0ms |
| `no-affix-mixed-item-grow`         |  7980 |      0 |     0 | 11340 |  87.0ms |
| `no-affix-heavy-item-grow`         | 22300 |      0 |     0 | 23000 | 303.9ms |
| `before-affix-grow`                | 10300 |    800 |     0 | 26600 | 190.3ms |
| `before-affix-shrink`              |  6900 |    800 |     0 |  7600 |  76.0ms |
| `dynamic-before-grow`              | 25500 |   1900 |     0 | 41100 | 298.6ms |
| `dynamic-before-shrink`            |  9700 |   1100 |     0 | 10900 | 106.2ms |
| `static-after-grow`                | 15500 |      0 |  1300 | 10600 | 154.3ms |
| `static-after-shrink`              | 17900 |      0 |  2100 | 16000 | 185.4ms |
| `static-before-dynamic-after-grow` | 17500 |   1600 |  1600 | 14700 | 196.1ms |
| `after-affix-shrink`               | 18600 |      0 |  2300 | 17300 | 210.8ms |
| `max-height-grow`                  |  5800 |      0 |     0 | 13000 | 132.0ms |
| `max-height-shrink`                |  4200 |      0 |     0 |  5000 |  65.0ms |
| `before-max-height-grow`           |  6100 |    800 |     0 | 16200 | 144.3ms |
| `before-max-height-shrink`         |  2700 |    800 |     0 |  5000 |  63.3ms |
| `mixed-lines-height-grow`          |  5800 |      0 |     0 | 13000 | 130.1ms |
| `mixed-lines-height-shrink`        |  4200 |      0 |     0 |  5000 |  63.5ms |

Benchmark caveats:

- `Total` is browser-settled elapsed time, including Vue updates, DOM/layout work, and the benchmark
  observation loop. It is not pure solver CPU time.
- Slot-call and rect-read counters are the more stable regression signals.
- Browser runs still print Chromium's non-fatal ResizeObserver loop notification.

## Correctness and coverage added

The branch adds browser guards for the behaviors that make these fast paths safe:

- no hidden materialized probe items remain after settlement
- materialized grow continues through baseline settlement if the search upper bound is too low
- stable `before` grow/shrink accepts only when before geometry stays stable
- dynamic `before` geometry falls back without underfilling or leaking hidden probes
- count-sensitive `after` digit-boundary changes settle correctly on grow and shrink
- `maxHeight`, `maxLines + maxHeight`, and before+maxHeight use the real root clip box
- CSS gap and common flex `align-items` values keep line counting correct
- reactive item width changes settle even when the `items` array identity does not change
- mixed-width and heavy-item-slot workloads are benchmarked

## Deliberately rejected paths

Several plausible optimizations were prototyped and rejected because they either failed correctness
proofs or made benchmark counters worse:

- materialized arbitrary `after` grow
- dynamic-after hint on gradual width changes
- conservative after-shrink candidate path
- public `staticAfter` hint prototype
- dynamic-before confidence disabling after geometry mismatch
- one-item last-line slack probe
- standalone microtask scheduler change

This is a useful part of the branch: the final solver is not "all possible fast paths"; it is the
subset that had a clear correctness proof and counter win.

## Reviewer-facing summary

For a PR description, the shortest accurate framing is:

> Optimize WrapClamp resize settlement by replacing many linear grow/shrink passes with verified
> static-flow hints and bounded materialized DOM search. The public API and DOM parts are unchanged.
> The largest benchmarked wins reduce item slot calls by 45-84%, layout rect reads by 21-75%, and
> settled elapsed time by 23-61% in the affected grow/shrink scenarios, while dynamic affix cases
> without a safe proof remain on the baseline live-DOM solver.
