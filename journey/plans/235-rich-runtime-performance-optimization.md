# Rich runtime performance optimization

## Goals

- Reduce avoidable work in `RichLineClamp` without changing visible clamp behavior.
- Keep the algorithm understandable and close to the current boundary-oriented design.
- Prefer hot-path wins that also simplify the runtime.

## Plan

1. Rework `packages/vue-clamp/src/rich.ts` so unchanged content can fast-exit before rich-run
   preprocessing.
2. Cache static rich preprocessing per source HTML instead of rebuilding grapheme metadata during
   every reclamp.
3. Remove per-probe candidate HTML serialization/parsing from the rich binary-search path and apply
   candidate fragments directly to the live DOM during measurement.
4. Update the design snapshot and runtime notes to reflect the new fast paths and trade-offs.
5. Run focused validation on rich browser tests plus `vp check`.
