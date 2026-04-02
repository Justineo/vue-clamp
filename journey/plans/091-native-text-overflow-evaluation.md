# 091 Native Text Overflow Evaluation

## Goal

Decide whether `packages/vue-clamp/src/component.ts` can replace its DOM-driven text trimming with browser-native overflow handling without breaking the current component contract.

## Scope

- `packages/vue-clamp/src/component.ts`
- `packages/vue-clamp/src/text.ts`
- `packages/vue-clamp/tests/clamp.browser.test.ts`
- `packages/vue-clamp/tests/width-sweep.browser.test.ts`
- `packages/vue-clamp/README.md`

## Evaluation Questions

1. Which current behaviors depend on the component rendering an actual trimmed string instead of visually clipping the full text?
2. Which public options exceed native `text-overflow` behavior?
3. Is there a narrow safe fast path where native overflow is still worth the extra branching?

## Constraints To Check

- `location` supports `start`, `middle`, and `end`
- `ellipsis` is configurable
- `before` and `after` slots share the same inline flow as the text
- `maxLines` and `maxHeight` can both drive collapse
- Browser tests currently assert both visible line counts and collapsed text content

## Plan

1. Re-read the runtime and browser tests to pin down the real contract.
2. Compare that contract against what browser-native overflow can do by itself.
3. If the overlap is large enough, define a native fast path. If not, keep the JS clamp and document the reason.
