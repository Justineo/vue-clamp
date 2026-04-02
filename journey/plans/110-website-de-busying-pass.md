# Website De-Busying Pass

## Problem

- The current page solved scope, but the `Component Reference` shell now wraps already-structured demo blocks.
- The result feels like card-inside-card UI instead of a restrained docs page.

## Direction

1. Remove the heavy outer framed shell.
2. Keep one clear tab-controlled reference area, but express it with headings, divider lines, and copy instead of a panel wrapper.
3. Restyle the tabs as a lighter document switch rather than a pill group in a capsule.
4. Flatten demo blocks so they read as stacked reference rows:
   - plain label
   - plain controls
   - one boxed preview area
5. Keep the sketch width / max-height guides.

## Validation

- `vp check --fix`
- `vp test`
- `vp run test:browser`
