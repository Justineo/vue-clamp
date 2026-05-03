# Demo stress playground

## Goal

Add an interactive website playground for manual stress testing many clamp component instances at once.

## Scope

- Add a demo control that opens a stress playground modal.
- Desktop modal should be centered and scrollable; mobile modal should use the full viewport.
- The playground should render a configurable number of examples from 10 to 1000 with a logarithmic slider.
- Controls should include shared width, `maxLines`, and `maxHeight` sliders.
- The rendered workload should use real `vue-clamp` components rather than synthetic placeholders.
- Keep this as manual demo tooling, not automated performance-regression infrastructure.

## Verification

- `vp check`
- `vp test`
- `vp run test:browser`
- Browser test coverage for opening the playground and updating the workload controls.
