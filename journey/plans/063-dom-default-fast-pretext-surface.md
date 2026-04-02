# 063 DOM Default + Fast Pretext Surface

## Goal

Evaluate a revised dual-engine product split:

- `vue-clamp` default entry becomes the browser-aligned DOM engine
- `vue-clamp/fast` becomes the pure Pretext engine

## Questions

1. Does this split produce a clearer product contract than the current hybrid component?
2. Is the default/browser-aligned engine a better fit for CSS features that the runtime cannot inspect directly?
3. What work is required before the current benchmark DOM path can be promoted to a supported public engine?
4. Would this be a strategic improvement or an unnecessary reset of the project direction?
