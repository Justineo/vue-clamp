## 2026-04-02

- Fixed `LineClamp` `maxHeight` fit probes so the visible root clip box is refreshed for each candidate text instead of being captured once before the search.
- Added a browser regression test that increases `maxHeight` from `20px` to `40px` after mount and verifies the visible text expands from one line to two.
- Updated `journey/design.md` with the per-probe `maxHeight` clip-box detail.
- Validation:
  - `vp check --fix`
  - `vp test`
  - `vp run test:browser`
