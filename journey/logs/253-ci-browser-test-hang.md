# 2026-04-12 CI browser test hang

- Started investigating why `vp run test:browser` hangs in GitHub Actions.
- Read `journey/design.md` first, then inspected the CI workflow and browser-test entrypoint.
- Using the investigation workflow:
  - local reproduction and config inspection
  - GitHub Actions check/log inspection for the actual CI evidence
- Findings:
  - the live PR job stayed in `Run vp run test:browser` on GitHub Actions without failing fast
  - local browser-file isolation showed the real hang in `packages/vue-clamp/tests/clamp.browser.test.ts`
  - the minimal reproducer was the rich fallback block around unsupported rich HTML with
    `maxHeight`
- Root cause:
  - `clampRichTextToLayout()` short-circuited on `fitsContent()` before checking whether the
    rendered rich layout was supported
  - for unsupported rich layouts with `maxHeight`, `RichLineClamp` could alternate between:
    - unclipped fallback mode (`fallback: true`, root `max-height` removed)
    - clipped non-fallback mode (`fallback: false`, root `max-height` restored)
  - that fallback-state oscillation kept retriggering recomputes and made the browser test step
    appear hung
- Fix:
  - moved the support check ahead of the full-fit short circuit in `packages/vue-clamp/src/rich.ts`
  - unsupported rich layouts now commit to fallback before any fit-based early return can toggle
    the clipped state
- Validation:
  - `vp check`
  - `vp test`
  - `vp test -c vite.browser.config.ts packages/vue-clamp/tests/clamp.browser.test.ts -t "falls back to raw html when descendants leave inline flow|does not clip raw html fallback when maxHeight is used|does not show over-limit rich html lines in the first frame after a width shrink|settles back within the requested rich html line limit after an external container width shrink" --reporter=verbose`
  - `vp test -c vite.browser.config.ts --reporter=verbose`
- Result:
  - the previously hanging rich fallback subset completed cleanly
  - the full browser suite completed locally in `31.84s`
