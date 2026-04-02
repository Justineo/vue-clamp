# 081 Max Height DOM Fit Fix

## Goal

Fix the `maxHeight`-only clamp fit check so the DOM-based entries do not underfill compared with the fast Pretext entry and the browser's actual available height.

## Steps

1. Replace the DOM `maxHeight` overflow test with a content-aware fit check that ignores non-content probe artifacts.
2. Mirror the same fix in the internal imperative benchmark DOM helpers so internal comparisons stay coherent.
3. Add browser regression coverage for the `maxHeight`-only case across the production entries.
4. Validate with check, tests, browser tests, and build; record the result in journey notes.
