# Remove Vue Prefixes

## Goal

Remove `Vue*` prefixes from current code and public exports where they are part of our maintained surface, while keeping the package name and runtime component name `vue-clamp`.

## Steps

1. Rename the component module and exports from `VueClamp` to `Clamp`.
2. Rename public types from `VueClampProps` / `VueClampExposed` to `ClampProps` / `ClampExposed`.
3. Rename the benchmark browser globals away from `Vue*`.
4. Update tests, docs, and demo snippets to match the new names.
5. Refresh the design snapshot and validate with `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
