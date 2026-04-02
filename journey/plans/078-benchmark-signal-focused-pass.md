# 078 Benchmark Signal Focused Pass

## Goal

Refocus the benchmark on scenarios that can actually differentiate the three component entries, and fix the current "initial" methodology so it measures cold mount/clamp work instead of a same-state update after mount.

## Steps

1. Replace the fake `initial` operation with a real cold-mount benchmark path.
2. Remove no-signal scenarios such as fit/noop cases and duplicate shared-vs-unique rows that do not expose meaningful differences at the component level.
3. Reduce shared benchmark overhead where possible so ratios reflect clamp work more than benchmark harness cost.
4. Update benchmark UI copy/tests and validate.

## Outcome

- Cold mount/clamp is now benchmarked as real fresh mount work.
- The benchmark suite is trimmed to signal-focused mount/text/slot scenarios.
- Shared benchmark overhead was reduced by removing no-op/duplicate rows and not forcing root autoresize where it no longer matters.
