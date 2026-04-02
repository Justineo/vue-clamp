# 097 Ratio Location Support

## Goal

Support numeric `location` ratios while keeping the implementation small and explicit:

- public `location` accepts `"start" | "middle" | "end" | number`
- the component normalizes that input to an internal ratio
- the text helper only receives normalized ratio data, not public enum aliases

## Steps

1. Update public typing and prop validation.
   - Expand `ClampLocation` to include numbers.
   - Accept string and number prop values.
2. Normalize once in the component runtime.
   - Add a helper that maps:
     - `start` -> `0`
     - `middle` -> `0.5`
     - `end` -> `1`
     - numeric values -> clamped `[0, 1]`
   - Use the normalized ratio for both native-path eligibility and JS trim rendering.
3. Simplify the text helper boundary.
   - Make `displayTextForKeptCount()` accept a ratio instead of public `location` strings.
   - Render from one generic prefix/suffix path with simple edge fast paths for `0` and `1`.
4. Update tests and docs.
   - Add browser/text coverage for ratio behavior.
   - Document numeric `location` support in README and project memory.
5. Validate.
   - `vp test`
   - `vp run test:browser`

## Outcome Target

- Numeric ratios work without introducing a second clamp strategy surface.
- Internal code is simpler because only the component knows about public `location` aliases.
