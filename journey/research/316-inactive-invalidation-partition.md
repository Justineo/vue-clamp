# Inactive invalidation partition

## Question

The measured components historically installed one `ResizeObserver`, one font-readiness listener,
and same-flush layout-signature checks per instance even when there was no clamp result to keep
current. This pass tested whether invalidation topology, rather than another candidate-search tweak,
could remove meaningful work without weakening the browser-layout correctness boundary.

The retained definition of an inactive instance is semantic rather than inferred from CSS:

- Line/Rich: expanded, empty source, or no active `maxLines` / `maxHeight` limit;
- Wrap: expanded, empty item list, or no active limit;
- measured Inline: empty body; native Inline already bypasses measured invalidation.

Owned source, limit, and expansion changes still schedule the reset or activation pass. Returning to
an active state measures the then-current DOM, so width, slot, CSS, or font changes that occurred
while inactive do not need to be observed individually.

## Retained mode partition

Inactive instances now skip:

- `ResizeObserver` construction and observation;
- `document.fonts` readiness/listener subscription;
- generic `onUpdated` border-box signature reads;
- initial mount recomputation when the initial rendered state is already the full source.

The high-density source benchmark mounts 400 LineClamp instances, performs 12 unrelated Vue
updates, changes the parent width, dispatches a font event, and unmounts. For the expanded case, the
always-active control versus the retained partition reported:

| Expanded 400-instance workload | Always active | Inactive partition |
| ------------------------------ | ------------: | -----------------: |
| Bounding-rect reads            |        12,800 |                  0 |
| ResizeObserver instances       |           400 |                  0 |
| ResizeObserver callbacks       |           800 |                  0 |
| Font listeners added/removed   |       400/400 |                0/0 |
| No-op update median            |       75.0 ms |            66.6 ms |

Elapsed time is noisy and includes fixed frame waits; the removed browser work is the acceptance
signal. A controlled expanded-to-collapsed regression changes width while observation is inactive,
then requires LineClamp to clamp the latest layout. Wrap coverage now expands, changes width, and
collapses again before checking the current prefix and slot state.

The final built runtime moved from the pre-pass `131,909 B` raw / `28,673 B` gzip checkpoint to
`132,240 B` raw / `28,735 B` gzip: `+331 B` raw / `+62 B` gzip. The increment is small enough for a
mode partition that removes whole invalidation mechanisms from inactive instances.

## Rejected shared observer/font hub

A second prototype shared one module-level ResizeObserver and one `loadingdone` listener across all
active instances. It reduced 400 active-instance observers/listeners to one and reduced two rounds
of ResizeObserver delivery from about 800 callbacks to two shared deliveries. It did not reduce the
actual per-instance recomputes or layout work:

- active mount median was approximately `23.9 -> 23.4 ms`;
- no-op update median stayed approximately `83.4 ms`;
- frame-bounded resize and font-event medians were unchanged.

The shared implementation increased the built runtime by about `2,086 B` raw / `401 B` gzip over
the direct-observer inactive partition. It also introduced global subscription bookkeeping and
different observer-delivery coupling between independent component instances. That is not a good
reliability/size trade for an effectively flat active-path result, so the hub was removed.

## Conclusion

Invalidation should follow semantic mode partitioning before it follows global batching. The safe
win is to avoid constructing and maintaining an invalidation graph when no clamp decision exists.
When a decision is active, each instance keeps the existing independent browser-observed geometry
model; cross-instance batching and public user hints remain out of scope.
