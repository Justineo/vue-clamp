# 168 Wrap Slot Prop Trim

- Started simplifying `WrapClamp` slot props to keep only `hiddenItems` as the hidden-item
  collection surface and remove `visibleCount` / `hiddenCount`.
- Removed `visibleCount` / `hiddenCount` from `WrapClampSlotProps` and updated the runtime slot
  prop factory.
- Updated website examples/docs plus wrap tests and benchmarks to derive counts from
  `hiddenItems.length`.
- Validation: `vp check` and
  `vp test -c vite.browser.config.ts packages/vue-clamp/tests/wrap.browser.test.ts packages/vue-clamp/tests/demo-page.browser.test.ts`
  passed. The browser run still reports the existing `ResizeObserver loop completed with
undelivered notifications.` warning.
