# Demo stress playground log

## 2026-05-03

- Added a website-only stress playground modal opened from the demo section.
- Moved the FPS monitor into the stress playground and removed the global demo FPS checkbox.
- The playground uses real clamp component instances, a linear 10-200 component count slider,
  shared width control, and separate `maxLines` / `maxHeight` sliders.
- Desktop uses a centered scrollable modal; mobile uses a full-screen modal.
- Added browser coverage for opening the playground, seeing the FPS meter, and updating workload
  controls.
- Added overlay-scrollbar instances to both the modal scroll viewport and the workload scroll
  viewport.
- Replaced the basic body overflow lock with a fixed-position scroll lock that restores the previous
  page scroll position and inline styles on close.
- Extended the playground from a LineClamp-only workload to a switchable workload for `LineClamp`,
  `RichLineClamp`, `InlineClamp`, and `WrapClamp`.
- Opening the playground from a component tab now selects that component by default.
- Added a payload scale control: text/rich/inline cases scale repeated text, and wrapped-item cases
  scale the generated item count.
- Changed stress limit controls to a single active `maxLines` or `maxHeight` mode instead of
  rendering both modes at once.
- Renamed the text payload control to text length and moved the stress playground trigger after the
  normal examples so diagnostic tooling does not lead the demo section.
- Removed explicit word-boundary stress props so the playground follows component defaults, and added
  a compact native marker for `LineClamp` workloads that match the CSS fast path.
- Moved the stress playground trigger into its own centered section between Examples and Usage.
- Simplified native clamp mode naming to single-line versus multi-line while keeping CSS details in
  the playground marker metadata.
- Verified with `vp check`, `vp test`, `vp run test:browser`, and a manual browser pass at
  `http://localhost:5175/`.
