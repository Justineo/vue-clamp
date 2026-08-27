# Pretext controlled-width exploration

Exact predictive clamping depends on source text, font, line limit, and content-box inline size. The
last input cannot be inferred exactly from authored styles without asking browser layout: padding,
box sizing, constraints, percentages, and inherited CSS can all change it. Under the requirement
that collapsed content never paints past the line limit, the viable choices are therefore a
caller-owned exact width, asynchronous observation under a hard visual cap, or a synchronous layout
read. The retained design supports the first two and rejects the third.

## Retained hybrid

An optional `inlineSize` prop is an authoritative content-box width. When present, the component
predicts before its first VNode and creates no `ResizeObserver`. When absent, the existing shared
content-box observer remains. Native line clamp plus an `lh` height cap stays active in both modes,
so pending, stale, or slightly pessimistic predictions cannot visibly overflow.

The controlled public-component matrix reduced summed active time from 2,613.0 ms to 473.5 ms
(`-81.9%`) across all 12 scenarios. Geometry reads fell from 88,057 to zero, resize callbacks from
10,688 to zero, and mutation records from 91,257 to 45,294. Each row improved by 72.2–93.2%, though
seven rows remain variance-gated. The Pretext consumer cost increased by 25 bytes gzip to 20,499
bytes.

## Why observation remains

In the 200-instance scale workload, pushing one shared reactive width through all children caused
4,800 child VNode updates in both smooth and jump profiles. Shared observation needed only 101
updates for smooth changes and 3,200 for jumps because unchanged visible prefixes bypassed Vue.
Resize wall medians stayed effectively equal: 198.3 versus 200.2 ms for smooth changes and 225.4
versus 224.6 ms for jumps. Controlled sizing is consequently the best path only when the application
already owns the per-component width; synthesizing it with another observer merely moves work and
can worsen propagation.

## Rejected paths

- Synchronous geometry reads caused layout thrashing and raised the 200-instance jump workload from
  about 225 ms to 540 ms.
- Parsing an inline `width` style cannot establish exact content-box size across box-model and CSS
  constraints, so it would turn an optimization into an implicit correctness heuristic.
- Sync watcher flushing, retaining an always-empty hidden source node, and changing observer-effect
  dependencies did not improve the controlled English jump case and added code or semantics.
- Removing the shared observer would save little code but would discard the better path for
  CSS-inherited sizing; independent observers previously changed 1 observer / 24 callbacks into
  200 / 4,800 without a latency benefit.

The remaining meaningful computation optimization belongs upstream in Pretext: its public line
walker allocates result and cursor objects, while the wrapper around that walker is already a small
share of hot-path time. Duplicating the browser-sensitive walker locally is not justified.
