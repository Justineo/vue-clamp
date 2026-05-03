# Website code split

## Goal

Reduce the website's initial JavaScript cost by moving non-primary dependencies out of the
eager `App.vue` path.

## Scope

- Split syntax highlighting into an async chunk with a plain-code fallback.
- Split code block UI from the main app component.
- Load OverlayScrollbars only when a decorated scroll container mounts.
- Keep the stress playground lazy-loaded.

## Validation

- Compare production build chunks before and after.
- Run `vp check`.
- Run `vp test`.
- Run `vp run test:browser`.
- Run `vp run build`.
