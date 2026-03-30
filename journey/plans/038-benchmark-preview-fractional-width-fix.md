# Benchmark Preview Fractional Width Fix

## Goal

Investigate and fix the `Single end clamp` preview regression where the Pretext benchmark preview can show 4 rows at certain responsive fractional widths even though the scenario is configured for 3 lines.

## Steps

1. Reproduce the issue at the reported viewport and inspect the actual preview host/root/text metrics.
2. Determine whether the divergence comes from preview layout behavior, engine measurement inputs, or clamp math.
3. Apply the smallest fix that makes the preview reflect real browser behavior at responsive widths.
4. Add browser coverage for the reported scenario so the preview cannot silently regress again.
5. Update journey memory with the confirmed root cause and chosen fix.
