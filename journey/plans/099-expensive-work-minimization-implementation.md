# 099 Expensive Work Minimization Implementation

## Goal

Implement the first high-signal optimization batch from plan 098 without changing the public API:

- remove dead per-reclamp width parsing
- cache prepared source data by `text`
- reduce per-candidate fit work
- reuse the previous clamp result on layout-only reclamps

## Steps

1. Refactor source preparation.
   - Move text segmentation ownership out of the inner clamp search path.
   - Prepare grapheme boundaries once per text change.
2. Simplify candidate rendering inputs.
   - Render collapsed candidates from prepared source data instead of re-splitting text on each reclamp.
3. Reduce layout-path waste.
   - Remove dead width parsing.
   - Collect rects once per candidate fit check.
4. Reuse previous search results.
   - Probe the previous `kept` first on JS reclamps.
   - Search only the necessary half-range when layout changes.
5. Validate.
   - `vp check`
   - `vp test`
   - `vp run test:browser`

## Outcome Target

- unchanged text is not re-segmented on width-only reclamps
- layout-only reclamps probe fewer candidates than a fresh full-range search
- the component remains a single readable DOM-driven runtime
