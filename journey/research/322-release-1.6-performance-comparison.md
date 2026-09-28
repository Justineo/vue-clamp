# Performance compared with published 1.6.0

Follow-up: [the rendering regression audit](323-line-rendering-regression-audit.md) adds paired
uncertainty, an identical-code control, and the retained text-leaf rendering fix. The figures
below preserve the original pre-fix screening run rather than mixing different candidates.

## Baseline and method

On 2026-09-05, the npm registry's latest `vue-clamp` release was 1.6.0. This comparison
uses that installed npm artifact against the current, unpublished 1.7.0 working tree.
It does not use the intermediate optimization baseline from research 320 or 321.

Both targets ran in the same production Vue 3.5.38 / Chromium process at 1280 by 900,
with target order alternating. The 135 public root scenarios used one warmup and
three measured samples with structural counters disabled. Five selected noisy rows
were repeated with seven measured samples. A separate 25-row, two-sample run enabled
counters to check the actual browser work. Benchmark active time includes activity
through the last DOM/observer update; it is not an OS CPU measurement or page FPS.

## Default root imports

The full screening sums each scenario's active-time median. These are workload-weighted
screening totals, not a universal application speedup or slowdown:

| Component     | Scenarios |      1.6.0 |    Current | Change |
| ------------- | --------: | ---------: | ---------: | -----: |
| LineClamp     |        45 | 4,644.4 ms | 4,947.2 ms |  +6.5% |
| InlineClamp   |        17 | 1,288.1 ms | 1,259.1 ms |  -2.3% |
| RichLineClamp |        46 | 5,889.9 ms | 5,911.0 ms |  +0.4% |
| WrapClamp     |        27 | 3,206.4 ms | 3,196.8 ms |  -0.3% |

Line's positive screening delta was concentrated in noisy resize rows. Seven-sample
follow-ups reduced the largest differences but did not establish a default-path speedup:

| Resize scenario                    |    1.6.0 |  Current | Change | Active RME, before / after |
| ---------------------------------- | -------: | -------: | -----: | -------------------------: |
| Line CTA affix, continuous         | 453.0 ms | 475.2 ms |  +4.9% |                8.3% / 5.7% |
| Line word copy, jitter             | 414.7 ms | 427.1 ms |  +3.0% |                7.4% / 3.4% |
| Line word copy, five lines, steps  |  44.0 ms |  51.9 ms | +18.0% |               19.7% / 4.6% |
| Line long token, tight font, jumps | 118.7 ms | 116.0 ms |  -2.3% |               13.1% / 5.7% |
| Inline middle, continuous          | 369.0 ms | 373.9 ms |  +1.3% |                6.6% / 4.2% |

All four Line follow-ups kept bounding-box, client-rect, style-read, and mutation counts
identical to 1.6.0. The time results leave a possible small default-Line overhead signal;
there is no established broad slowdown magnitude, and this evidence does not justify
claiming that default resize performance improved or that regressions are ruled out.

Specific retained gains remain visible against the actual release:

- Line source-update rows reduce bounding-box reads from 1,080 to 888 (cold long text),
  576 to 384 (native), 1,152 to 864 (word + after), and 1,056 to 864 (word + height).
  These are 17.8–33.3% fewer reads, with fewer DOM mutations in all four rows.
- Six Inline split source-update rows reduce total geometry reads from 9,000 to 7,032
  (-21.9%) and mutations from 8,124 to 5,760 (-29.1%). Their counters-off summed active
  medians are 140.7 versus 106.7 ms (-24.2%) in this run. Ordinary resize controls do not
  show the same benefit; the highly skewed-glyph case is structurally neutral.
- Rich repeated-HTML updates take 46.6 versus 40.0 ms (-14.2%, active RME 2.4% / 1.1%).
  Unique-HTML updates take 48.0 versus 48.2 ms. Browser layout counters stay unchanged;
  the gain is in preparation. This 16-instance fixture differs from research 321's
  200-instance update-flush fixture, so its percentage must not replace that result.
- Six Wrap before-affix rows save 400 or 800 bounding-box reads per scenario. All other
  inspected work counters stay unchanged. Whole-component timing is effectively flat.

## Consumer delivery size

Each consumer was independently built with the same production Vite/esbuild settings,
Vue external, and gzip level 9. Root imports remain tree-shaken; the all-components row
is a separate build and must not be reconstructed by summing individual imports.

| Import                   |  1.6.0 gzip | Current gzip |                     Difference |
| ------------------------ | ----------: | -----------: | -----------------------------: |
| LineClamp                |     9,093 B |      9,580 B |                         +487 B |
| InlineClamp              |     5,350 B |      5,321 B |                          -29 B |
| RichLineClamp            |    13,138 B |     13,215 B |                          +77 B |
| WrapClamp                |     5,434 B |      5,482 B |                          +48 B |
| All four root components |    22,298 B |     23,344 B |                       +1,046 B |
| Opt-in Pretext LineClamp | unavailable |     29,371 B | +20,278 B versus old LineClamp |

The optional engine is a separate import decision, not a performance benefit or payload
that every 1.6.0 consumer receives automatically.

## Opt-in engine compared with the released LineClamp

Five representative Pretext scenarios compared the 1.6.0 root LineClamp directly with
current `vue-clamp/pretext`, using three measured samples and counters enabled. The
English, CJK, and affixed-English continuous-resize fixtures reduced geometry reads to
zero. Their active-time reductions were 21–30%, but high timing RME (up to 81.6%) and
instrumentation make these directional diagnostics, not a precise throughput claim.

Two 240 ms CSS width transitions over 16 instances are the more appropriate engine-cost
fixture. Animation duration stays fixed; callback duration and browser work measure the
change. Both versions observed 928 entries per scenario. The instrumented baseline made
4,336 or 6,640 bounding-box reads and 3,712 style reads, while Pretext made none. DOM
mutations fell from 1,890 to 258 without affixes and 2,162 to 450 with affixes. A separate
seven-sample, counters-off repeat supplies the callback timings below.

| CSS transition  | 1.6.0 callbacks | Pretext callbacks | Change | Callback RME, before / after |
| --------------- | --------------: | ----------------: | -----: | ---------------------------: |
| Without affixes |         62.4 ms |            8.3 ms | -86.7% |                 6.9% / 12.0% |
| With affixes    |         57.9 ms |            8.3 ms | -85.7% |                  7.1% / 4.6% |

Both counters-off transition cases had zero dropped frames for both targets. The reduction
is in callback processing time, not animation duration or a demonstrated frame-rate increase.
These gains apply to eligible predictive cases; native CSS and measured fallbacks do not
inherit the same savings.
