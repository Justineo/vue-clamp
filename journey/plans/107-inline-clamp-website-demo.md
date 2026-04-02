# InlineClamp Website Demo

## Goal

Add `InlineClamp` to the website without making the page feel heavier or more doc-like.

## Information Structure

1. Keep the page as one lightweight reference page.
2. Make the dual-surface package model explicit:
   - `LineClamp` for multiline DOM-driven clamping
   - `InlineClamp` for native one-line truncation
3. Preserve the current flow:
   - features
   - demos
   - usage
   - API
4. Avoid mixing the two components into one table or one overloaded demo.

## Demo Strategy

- Keep the existing four `LineClamp` demos together.
- Add a single `InlineClamp` demo block after them.
- Make the inline demo comparative:
  - one plain row
  - one split-aware row
- Use a width slider and a small example preset switcher.
- Use examples that show why `split` exists:
  - filename
  - email
  - path

This keeps the demo expressive without adding many controls.

## Usage Strategy

- Keep installation unchanged.
- Replace the single example block with two short example blocks:
  - `LineClamp`
  - `InlineClamp`

## API Strategy

- Keep the API section compact but separate the two surfaces.
- Add a small component summary table first.
- Keep the current `LineClamp` props/slots/events tables.
- Add `InlineClamp` props and the `split()` return contract.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
