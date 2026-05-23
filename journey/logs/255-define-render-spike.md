# defineRender migration log

## 2026-05-23

- Replaced the local WrapClamp render-binding compiler glue with Vue Macros `defineRender`.
- Added `@vue-macros/define-render` as a cataloged root dev dependency and wired its Vite and
  Rolldown plugins into test, benchmark, website, and package build configs.
- Removed `scripts/vue-clamp-sfc-compiler.ts`; the repo no longer owns a custom template compiler
  or marker-template plugin.
- `WrapClamp.vue` now calls `defineRender(render)` after its setup-local render function. Package
  output confirms the macro compiles to `return render;` with no `defineRender`,
  `WrapClampRenderBinding`, `_renderList`, or `_renderSlot` in the WrapClamp hot path.
- This replaced the earlier custom compiler-lowering path; the selected design is now recorded in
  `journey/design.md`.
- Focused WrapClamp benchmark:
  - current log: `/tmp/vue-clamp-benchmark-define-render-20260523.log`
  - compared with `/tmp/vue-clamp-benchmark-render-binding-20260523.log`: mean `-0.43%`, median
    `-0.42%`, no scenario above `+5%`, and no slot-call or rect-read counter changes
  - compared with `/tmp/vue-clamp-benchmark-main-full-20260523.log`: mean `-0.57%`, median
    `-0.47%`, no scenario above `+5%`, and no slot-call or rect-read counter changes
- Validation passed:
  - `vp check --fix`
  - `vp test packages/vue-clamp/tests/wrap-render-source.test.ts`
  - `vp test`
  - `vp run -F vue-clamp build`
  - `vp test packages/vue-clamp/tests/wrap.browser.test.ts -c vite.browser.config.ts`
  - `vp test -c vite.browser.benchmark.config.ts packages/vue-clamp/tests/wrap.browser.benchmark.ts`
  - `vp test -c vite.browser.config.ts`
  - `vp run build`
