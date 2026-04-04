# Source guard review

## Goal

Review the full `packages/vue-clamp/src` surface for environment checks, fallback branches, and defensive guards to determine which ones are justified and which ones are extra complexity.

## Focus

- `ResizeObserver` guards
- `document.fonts` guards
- text segmentation fallback assumptions
- consistency of "has limit" normalization across clamp components

## Output

- review findings with file references
- explicit keep/remove judgment for the `ResizeObserver` existence checks
