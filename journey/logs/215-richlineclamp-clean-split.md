# 2026-04-08

- User chose the clean end state instead of a compatibility path because rich-html clamping has not
  shipped yet.
- Implementation direction for this pass:
  - add a dedicated public `RichLineClamp`
  - make `LineClamp` text-only again
  - update tests, docs, demos, and exports to treat `RichLineClamp` as the canonical rich surface
- Implemented the clean split:
  - added `packages/vue-clamp/src/RichLineClamp.ts`
  - made `packages/vue-clamp/src/LineClamp.ts` text-only again
  - narrowed `LineClampProps` and added `RichLineClampProps`
  - exported `RichLineClamp` from the package entry
  - moved rich browser coverage to the new component
  - updated the website to present `RichLineClamp` as a separate fourth surface
  - updated package docs and changelog copy to match the new public contract
- Validation passed with:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
- Existing browser-runner noise is unchanged:
  - `ResizeObserver loop completed with undelivered notifications.`
  - Shiki singleton warnings from the website suite
