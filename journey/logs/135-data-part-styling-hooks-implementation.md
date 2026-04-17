# Data-part styling hooks implementation log

## 2026-04-03

- Agreed final direction:
  - keep only `data-part`
  - no `data-scope`
  - no root state attrs
  - no compatibility aliases for old internal hooks
- Planned one-pass refactor across runtime, docs site, tests, and docs to avoid mixed selector styles.
- Implemented `data-part` anatomy across:
  - `LineClamp`
  - `InlineClamp`
  - `WrapClamp`
- Removed the old `data-inline-*` and `data-wrap-*` internals instead of keeping aliases.
- Updated website CSS selectors, browser helpers, browser tests, README, and design memory to match the new contract.
