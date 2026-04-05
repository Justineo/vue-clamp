# 193 - Line demo startup font recompute

## Goal

Investigate and fix the LineClamp demo startup state where text renders larger than expected until a control change triggers recomputation.

## Plan

1. Reproduce/infer the startup mismatch path by reviewing `LineClamp` recompute triggers and demo styling behavior.
2. Patch `LineClamp` to recompute when late style/font metric changes affect clamped content without changing root geometry.
3. Add/adjust browser contract coverage for a max-height scenario where typography changes post-mount.
4. Run targeted tests/checks, then document outcomes in journey logs.
