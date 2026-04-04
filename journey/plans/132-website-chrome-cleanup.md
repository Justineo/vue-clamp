## Goal

Polish the website chrome after the recent `WrapClamp` demo additions so the docs surface feels lighter and the new tabs overflow demo is actually usable.

## Scope

- Make the wrap-tabs overflow trigger read as a ghost icon action, not as another tab.
- Fix the teleported dropdown anchor-positioning syntax and keep a JS fallback.
- Ensure new website interaction styles use `:focus-visible`, not plain `:focus`.
- Remove non-essential horizontal borders between top-level sections and rely on spacing unless an explicit divider is truly needed.

## Steps

1. Update the wrap-tabs demo styles and teleported menu positioning.
2. Sweep website focus styles and add any missing `:focus-visible` affordances for the new controls.
3. Simplify section and subsection dividers in the docs site CSS.
4. Validate with website/browser checks and record the result.
