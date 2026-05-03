# Website code split log

## 2026-05-03

- Baseline after the stress playground lazy split still had a large primary website bundle:
  `index-BHI7KZoe.js` at 783.90 kB / 138.67 kB gzip, plus an eager
  `overlayScrollbars-ChjvSAhT.js` chunk at 123.83 kB / 49.39 kB gzip.
- Moved Shiki setup and language/theme imports into `packages/website/src/highlight.ts`, loaded by
  dynamic import after mount. Code blocks keep a plain-code fallback until highlighted HTML is ready.
- Converted `CodeBlock.vue` to an async component and kept the stress playground async.
- Changed `packages/website/src/overlayScrollbars.ts` so the OverlayScrollbars library and CSS are
  loaded by dynamic import on first decorated scroll surface instead of at module evaluation time.
- Production build after the split:
  - primary website JS: `index-CDyihdvS.js` 86.81 kB / 19.43 kB gzip
  - lazy highlighting chunk: `highlight-DD1uq7h-.js` 694.02 kB / 118.59 kB gzip
  - lazy code block chunk: `CodeBlock-DjCNK5gE.js` 2.35 kB / 1.21 kB gzip
  - lazy OverlayScrollbars runtime chunks: `overlayScrollbars-GmCmuAx1.js` 63.59 kB /
    25.41 kB gzip and `overlayscrollbars-2WRqfFAI.js` 29.87 kB / 14.75 kB gzip
- Verified with `vp check`, `vp test`, `vp run test:browser`, and `vp run build`.
