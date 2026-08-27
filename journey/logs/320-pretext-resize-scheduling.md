# Pretext resize scheduling experiments

The retained component keeps the shared asynchronous content-box observer and updates a stable
visible text node directly when the accessibility structure does not change. Three isolated
alternatives established that boundary.

## Independent observers

Replacing the shared observer with one observer per active instance changed the 200-instance,
24-resize workload from 1 observer / 24 callbacks to 200 observers / 4,800 callbacks. Smooth and jump
wall medians remained effectively flat at about 199 ms and 225 ms, with the same mutation and
component-update counts. The consumer bundle fell by 51 bytes gzip, but the full public matrix split
delivery into 11,200 observer callbacks and 6,557 mutation-callback batches without a timing win.
Independent observers were therefore rejected: they save a small amount of source/runtime size by
giving up the batching behavior that matters specifically to this high-volume opt-in path.

## Synchronous geometry fast path

Adding `getBoundingClientRect()` on mount and every Vue update removed the observer wait for
Vue-driven width changes, but interleaved component reads and reactive writes caused layout
thrashing. The 200-instance jump workload rose from about 225 ms to 540 ms; smooth work stayed near
200 ms. This path also broke the zero-geometry-read resize contract. It was rejected rather than
hidden behind a heuristic or a new width hint.

## Stable visible-text ownership

The previous computed-result path scheduled a Vue component patch whenever a changed width produced
a new prefix. The retained path resolves observer entries directly, performs no work for identical
results, mutates the existing text node for prefix-only changes, and lets Vue own transitions that
add or remove the visually hidden source node.

In the 200-instance jump workload, component updates fell from 4,000 to 3,200 while mutation records
stayed at 7,200 and wall time stayed near 225 ms. In the full public matrix, Pretext mutation records
fell from 52,635 to 48,118 (`-8.6%`); the long-token continuous row fell from 6,720 to 5,584
(`-16.9%`). The consumer bundle increased from 20,408 to 20,474 bytes gzip. Active timing remained
too variable to claim an additional speedup, so the retained claim is narrower: less Vue patching
and browser mutation work without changing output, geometry reads, or resize latency.
