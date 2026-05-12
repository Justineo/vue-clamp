# Type organization review

- Reframed the review from a `ClampLength`-specific export question into a full source type
  organization pass.
- Inventoried package API types, private `types.ts` building blocks, helper-module contracts,
  runtime helper local types, component-local solver/probe types, and test/website consumer types.
- Main gap: the project has an implicit layering model, but `types.ts` and the design notes do not
  distinguish package API types from source-helper contracts clearly enough.
- Implemented the four-layer split in source:
  - root package API now exports `ClampLength` alongside the public component contracts
  - text helper contracts are readonly and fully named from `text.ts`
  - rich helper contracts are structurally complete and fully named from `rich.ts`
  - native and multiline helper function signatures expose source-module contract types from their
    owner modules
  - `packages/vue-clamp/tests/type-surface.ts` type-checks package API and helper API boundaries
- Added internal slot-map contracts (`LineClampSlots`, `RichLineClampSlots`, `WrapClampSlots<T>`)
  and wired component implementations to Vue `SlotsType` without re-exporting those maps from the
  package root.
- Tried typing the raw `WrapClamp` export itself as a generic constructor, but it polluted
  `h(WrapClamp, ...)` overload selection in current TypeScript/Vue types.
- A `createWrapClamp<T>()` specializer was also prototyped and then removed because it would add a
  new public API during a type-organization cleanup. Precise generic `WrapClamp` slot support is
  deferred to a separate design.
