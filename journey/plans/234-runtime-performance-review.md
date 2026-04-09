# Runtime performance review

## Scope

- Review current runtime performance of the clamp surfaces, with emphasis on `RichLineClamp`.
- Identify unnecessary work in hot paths and whether existing fast paths are sufficient without
  compromising correctness.

## Steps

1. Inspect the current rich/text/layout runtime hot paths and their recompute triggers.
2. Check whether existing benchmarks or browser tests cover the relevant surfaces.
3. Evaluate the current implementation for avoidable DOM writes, repeated preprocessing, and
   missed fast paths.
4. Summarize findings ordered by severity, plus residual risks and worthwhile optimizations.
