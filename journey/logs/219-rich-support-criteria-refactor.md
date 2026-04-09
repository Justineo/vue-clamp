# 2026-04-08

- Starting the rich support-criteria refactor:
  - remove the large wrapper tag whitelist
  - define support by reconstructable light DOM plus computed inline layout
  - keep explicit special handling only for `br`, `wbr`, atomic `img`, and outer `svg`
- Implemented:
  - `packages/vue-clamp/src/rich.ts` now treats wrapper elements by behavior instead of a fixed
    wrapper tag whitelist
  - parse-time special cases are now limited to:
    - explicit unsupported non-content elements such as `script`, `style`, form/media/embed nodes
    - explicit break elements `br` and `wbr`
    - explicit atomic elements `img` and outer `svg`
  - wrapper support now depends on two checks:
    - light DOM must contain truncatable content that the materializer can rebuild
    - rendered layout must still validate as inline or `contents`
  - inline custom elements with light DOM content now participate in clamping under the same rule
  - custom elements without light DOM content fall back to raw HTML with a development warning
  - docs, changelog, website API copy, and the rich demo now describe the behavior-based contract
- Validation:
  - `vp check`
  - `vp test`
  - `CI=1 vp run test:browser`
- Browser noise remains unchanged:
  - `ResizeObserver loop completed with undelivered notifications.`
  - Shiki singleton warnings in website browser tests
