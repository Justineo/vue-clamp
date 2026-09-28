# Rich structural batching: explored, not integrated

## Decision

Do not broaden RichLineClamp batching with these prototypes. Real rich content can resume shared
text measurement after crossing a leaf boundary, but fewer layout flushes did not establish a useful
end-to-end improvement. Combining this with batched full-tree inspection improved the font-change
fixture by about 4%, while slowing the image/height fixture by about 4.7%. The current narrow Rich
paths remain unchanged; this investigation does not resolve whether retaining the single-text-node
extension itself is worthwhile. Its earlier plain-text gains cannot be generalized to real markup.

## Mechanisms

Three isolated production builds compared against the current working implementation:

- **Rejoin:** before changing tree structure, yield a serial write/read action. Drain pending text
  candidates before running these actions, then allow stable cuts in the next leaf to join a later
  shared round. Full-tree restoration and support inspection at search startup remain synchronous.
- **Inspection:** yield full-tree restoration separately from layout inspection so instances share
  that stage. Keep the original serial continuation after a later structural candidate or leaf crossing.
- **Combined:** use both changes. Neither route admits cold/unclamped starting states, intrinsic
  widths or empty markers that were excluded by the surrounding runtime.

These prototypes coordinate serial work; they do not batch arbitrary structural mutations as if they
were text writes. The inspection route does share full-tree restoration, and therefore has a wider
CSS-context concern than rejoining text rounds. Explicit width alone does not prove independence
under arbitrary selectors. No containment, second probe tree, persistent verdict cache or public API
was added.

## Production measurements

Chromium 149.0.7827.55, 20 instances, 12 updates per sample, eight rotated
baseline/candidate/duplicate-baseline rounds after warmup. Each rich fixture contains multiple
formatted leaves; width sweeps alternate 64–900 px to exercise leaf crossings. The font fixture uses
relative child font sizes and changes the inherited size while dispatching font completion. Links
include a live after slot; images include passive inline images and a height limit. All settled
markup matched after every update.

Values below are paired changes in browser `TaskDuration`, including output capture, with 95%
bootstrap intervals from 10,000 resamples of mean log ratios. Negative means faster. These are
whole-update costs, not isolated solver time or frame rate.

| Actual rich workload               |                  Rejoin |                Inspection |                Combined |
| ---------------------------------- | ----------------------: | ------------------------: | ----------------------: |
| Formatted width sweep              | +1.79% (−1.65 to +4.75) |   +3.27% (+0.26 to +5.76) | +0.88% (−1.85 to +3.62) |
| Links + after slot, width sweep    | +0.07% (−1.32 to +1.19) |   +6.18% (+4.46 to +7.84) | +1.01% (−0.78 to +2.78) |
| Formatted font changes             | −0.71% (−2.46 to +1.06) |   +6.17% (+5.03 to +7.23) | −4.05% (−5.38 to −2.88) |
| Images + height limit, width sweep | +3.57% (+1.54 to +5.99) | +11.49% (+9.61 to +13.31) | +4.74% (+3.01 to +6.36) |

For combined, font-update median task time was 153.86 → 145.85 ms per sample, and image-update time
was 128.38 → 135.07 ms. Their duplicate-baseline changes were −1.37% (−3.45 to +0.94) and +1.62%
(−0.41 to +3.59), respectively. All combined control intervals included zero. Rejoin and inspection
image controls showed nonzero drift (+2.41% and +2.67%), so their exact regressions need more caution;
these controls do not supply evidence of a hidden broad win.

### Layout count is insufficient

Combined's median native layout metrics illustrate the trade-off:

| Workload              |  Layout count |  Layout duration |
| --------------------- | ------------: | ---------------: |
| Formatted width sweep | 2,212 → 1,775 | 57.17 → 61.00 ms |
| Links + after slot    | 2,212 → 1,699 | 61.15 → 65.52 ms |
| Font changes          | 2,652 → 1,512 | 61.77 → 60.69 ms |
| Images + height limit | 2,118 → 1,472 | 48.37 → 54.62 ms |

The remaining layout calls are more expensive on average. This is consistent with combining more
dirty work into each layout, but these counters do not identify the exact invalidation scope or
prove a causal explanation. Inspection alone was slower in all four measured workloads. Rejoin
alone reduced layout counts without establishing an elapsed-time gain.

## Compatibility and size

All three prototypes matched baseline/control output in Chromium 149.0.7827.55, Firefox 153.0 and
WebKit 26.5 across six held-out workloads: formatted markup with an affix, alternating long/short
linked source, font changes, images with a height limit, nested markup, and a selector coupling the
probe's structure to the visible root. Each used four instances and four updates after warmup.
Source and width updates also compared public markup immediately after one `nextTick`; font events
were compared after their asynchronous delivery. This is a bounded output screen, not a universal
CSS-equivalence proof. Combined additionally passed 174 existing Chromium browser assertions across
mixed batching, preparation, font delivery and component contracts using a temporary source overlay.
That temporary config emitted a website dependency-scan warning and the usual ResizeObserver loop
diagnostics; they did not prevent the selected tests from passing.

Consumer gzip changed little: RichLineClamp was 15,264 B baseline, 15,230 B rejoin, 15,274 B inspection
and 15,269 B combined. Combined added 38 B to LineClamp and 40 B to InlineClamp through the shared
scheduler; WrapClamp was unchanged. Size is not the rejection reason. The broader scheduling and
CSS-context obligations lack a compensating general performance benefit.

[Archived patches and reproduction](./336-prototypes/README.md) preserve the working baseline,
three candidates and actual rich fixtures. [Measurements](./336-prototypes/measurements.json)
retain per-round counters, paired summaries, duplicate controls, bundle sizes and engine metadata.
