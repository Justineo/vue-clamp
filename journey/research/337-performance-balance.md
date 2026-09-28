# Recommended performance balance

> Subsequent implementation: [research 338](./338-compact-unit-range.md) expands the ASCII upper
> bound to U+02FF without adding a lookup table or branch. The Rich recommendation remains unapplied.

## Recommendation and current state

Prefer the existing implementation plus the four-entry preparation pool and Wrap upper-endpoint
probe. Retain the original ASCII fast path. Remove the research-333 warm single-text-node Rich
extension, while keeping the earlier research-327 same-leaf Rich batching and shared delivery.
Do not integrate the Unicode alphabet, broader structural Rich batching, Typed OM eligibility or
high-limit fit-loop experiment.

This is a recommendation following research 336, not an applied runtime change. The working tree
still includes the warm plain Rich extension. An isolated candidate and
[reversal patch](./337-evidence/lean-rich.patch) make the proposed smaller combination reviewable.
The existing preparation browser regression can remain: it checks public settlement against a serial
sibling and passes with the smaller implementation too. When implementing this recommendation,
remove the plain-HTML Rich performance claim from the changelog and update the current-state notes.

## Selection rationale

| Route                                                                                         | Recommendation                                     | Reason                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing ASCII shortcut                                                                       | Keep                                               | Numeric admission bounds, no language list or data maintenance                                                                                                                                         |
| Four-entry pure preparation pool                                                              | Keep at four entries / 8,192 combined UTF-16 units | Reuses two/four-source cohorts across Line and Inline without sharing DOM, typography or layout answers; capacity stays bounded                                                                        |
| Later Wrap growth endpoint probe                                                              | Keep                                               | A local candidate-order change, no new persistent state or lifecycle phase; dense height/line fixtures improved about 15–21% in isolated research 332                                                  |
| Warm single-text-node Rich extension                                                          | Recommend removing                                 | Measurable benefit for larger plain-HTML cohorts, but none established for actual rich markup; introduces additional full-candidate eligibility and synchronous completion/slot-settlement obligations |
| Real-rich structural rejoining and inspection                                                 | Leave archived                                     | Research 336 found neutral or worse total time except a modest font gain traded against image regressions                                                                                              |
| Generated Unicode alphabet, wider computed-width eligibility, exceptional high-limit grouping | Leave archived                                     | Respectively excessive delivery cost, unresolved CSS proof, and insufficient representative workload evidence                                                                                          |

Four entries are a conservative tested cap, not a claim of an optimal cache size. The aggregate
source budget is unchanged from the former single entry; it is a source-unit limit, not an 8 KB heap
limit. Two/four-source reuse improved isolated CJK Line updates by roughly 15–16% and emoji/mixed
Inline by roughly 5% in research 332. Eight interleaved or distinct sources did not gain. There is no
workload evidence to enlarge retention or add a public tuning knob.

The Rich extension is small in bytes, and its larger-cohort gains are real. The deciding cost is the
extra timing invariant: full-candidate batching can change clamped state, so visible text and slot
status must begin committing inside measurement completion before Vue leaves post-flush. The older
same-leaf path does not add that full-candidate transition. The recommendation favors fewer such
obligations when the demonstrated gain occurs outside Rich's distinguishing markup capability.
No usage telemetry was collected, so this does not establish how often consumers pass plain HTML.

## Marginal Rich comparison

The lean candidate restores only `rich.ts` and `RichLineClamp.vue` to `d826aa5`; all other current
source, including the pool, Wrap change and ASCII policy, is identical. Chromium 149.0.7827.55 ran
1, 4 and 20 instances, 12 updates per sample, eight rotated lean/current/duplicate-lean rounds after
warmup. The driver uses the real-rich fixtures from research 336 and compares exact settled markup
after every update. Negative changes favor retaining the warm extension.

| Twenty-instance workload                 | Lean task median | Current task median | Current vs lean, paired 95% interval | Median difference per cohort update |
| ---------------------------------------- | ---------------: | ------------------: | -----------------------------------: | ----------------------------------: |
| Plain HTML, resize                       |         56.74 ms |            49.75 ms |           −13.22% (−15.72 to −10.98) |                           −0.582 ms |
| Plain HTML, synthetic font-metric change |         76.31 ms |            64.96 ms |           −16.32% (−21.23 to −10.24) |                           −0.945 ms |
| Links with after slot, width sweep       |        149.81 ms |           150.79 ms |              −0.45% (−2.49 to +1.69) |                           +0.081 ms |
| Formatted HTML, font-metric change       |        148.71 ms |           148.86 ms |             −1.64% (−12.06 to +6.17) |                           +0.013 ms |

All candidate intervals at one and four instances included zero. Small samples were noisy; this is
absence of an established gain, not proof of zero cost. Twenty-instance duplicate-control intervals
also included zero; one four-instance links control showed drift, so its small apparent difference
is not actionable. The complete controls and samples are in
[measurements](./337-evidence/measurements.json).

TaskDuration includes browser work and output capture. The per-update column divides the difference
of 12-update sample medians by 12; it is not a measured individual call, paint latency, or a per-instance
saving. Hardware and consumer content can change the trade-off. Applications with large, frequently
updated plain-HTML Rich cohorts may reasonably value this saving more highly than this recommendation.

The lean candidate passed 174 Chromium browser assertions covering mixed batching, preparation,
font delivery and component contracts. The temporary source-overlay configuration emitted the same
unrelated website dependency-scan warning and standard ResizeObserver diagnostics as research 336;
selected assertions passed. No new cross-engine claim is made for this marginal comparison.

Consumer gzip was 15,180 B lean versus 15,264 B current for Rich alone; all root exports were
26,184 B versus 26,512 B. Line/Inline moved by small compression differences and Wrap was unchanged.
Bundling and symbol/compression interactions make combined-export changes non-additive. Size is a
secondary benefit of removing the extension, not the primary justification.

## Stopping and reopening criteria

Evaluate each additional optimization against its marginal benefit over the selected combination.
Require a representative workload, an absolute saving worth its added invariants, reproducible
end-to-end evidence beyond duplicate-control noise, and neutral held-out cases. A smaller layout
count or a single percentage win is insufficient. A local candidate-order improvement can justify
less benefit than a new lifecycle phase, authoritative cache or expanded CSS assumption.

Reopen warm Rich if an actual target workload demonstrates frequent large plain-HTML cohorts, or if
its benefit can be obtained without the additional completion path. Reopen structural batching only
with evidence spanning formatted text, links/affixes, atomic content and font changes, together with
a defensible CSS-context model. Do not invent a universal percentage threshold or workload weighting
without consumer data. Current evidence supports stopping at the smaller combination.

## Reproduction

Reconstruct the working baseline using `journey/research/336-prototypes/baseline.patch` on
`d826aa59130bb154ac292defcd66f00f3efa6722`. In a separate lean checkout, apply
`journey/research/337-evidence/lean-rich.patch`. Install and build each package with Vite+. Apply
`journey/research/336-prototypes/fixtures.patch` in the driver checkout and compare lean as `before`, current as
`after`, with counts `1,4,20`, eight rounds, 12 steps, and scenarios:
`resize-rich-plain,font-rich-plain-metrics,resize-rich-links-cross-affix,font-rich-formatted-metrics`.
Use the research-332 consumer-size driver for both package builds. Stored fingerprints hash sorted
JavaScript filenames and content; declarations and maps are excluded.
