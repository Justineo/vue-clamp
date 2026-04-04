# WrapClamp cache validity investigation

## Goal

Determine why the current cache-backed `WrapClamp` benchmark shows no benefit, verify whether the benchmark actually exercises the cache path, and assess whether the benchmark is representative of the stress-table interaction the user cares about.

## Plan

- Read the current `WrapClamp` cache gates and invalidation logic to identify when the cache is active.
- Inspect the stress demo and benchmark workload to see whether they match those gates.
- Add or use lightweight instrumentation to verify whether cache-assisted probe skipping actually occurs in the benchmark/demo scenario.
- If needed, run targeted measurements on scenarios that do and do not exercise the cache.
- Record conclusions in `journey/` and summarize whether the current benchmark is valid, partially valid, or invalid for the stated question.
