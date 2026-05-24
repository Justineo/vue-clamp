# defineRender migration evidence

## 2026-05-23

- Replaced the local WrapClamp render-binding compiler glue with Vue Macros `defineRender`.
- The durable design outcome is recorded in `journey/design.md`; this log keeps the process
  evidence for why the custom compiler path was rejected.
- Package output confirmed the macro compiles to the returned setup-local render function, with no
  `defineRender`, `WrapClampRenderBinding`, `_renderList`, or `_renderSlot` left in the WrapClamp
  hot path.
- Focused WrapClamp benchmark evidence:
  - compared with the custom render-binding implementation: mean `-0.43%`, median `-0.42%`
  - compared with the main-branch full benchmark: mean `-0.57%`, median `-0.47%`
  - no scenario regressed above `+5%`
  - slot-call and rect-read counters did not change
