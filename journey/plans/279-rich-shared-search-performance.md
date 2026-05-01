# Rich clamp shared search performance

Date: 2026-05-01

## Goal

Extend the text warm-start optimization into a shared monotonic search helper and evaluate whether
`RichLineClamp` can benefit from the same idea without importing text-specific result contracts.

## Constraints

- Preserve synchronous clamp correctness; do not add frame-delayed rendering or paint stale results
  intentionally.
- Share only the stable search strategy, not text-specific data shapes.
- Benchmark cold and warm paths separately, and include continuous, jittered, large-jump, and
  component end-to-end scenarios.
- Keep code added only where benchmark results show the line is worth it.

## Approach

- Move the monotonic warm-start binary search into a small shared helper.
- Keep text clamp using the shared helper through its existing `{ boundaryOffsets, kept }` hint.
- Let rich clamp derive coarse and fine search hints from the previous `RichClampDecision` when the
  previous point still exists in the current prepared runs/cuts.
- Expand rich benchmark coverage before drawing conclusions.

## Validation

- Unit tests for the shared search helper through the real text clamp helper contract.
- Browser contract tests for text/rich clamp behavior.
- Text and rich benchmark comparisons against `947de14`.
- Full `vp check`, `vp test`, and relevant browser benchmarks before final report.
