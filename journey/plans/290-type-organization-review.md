# Type organization review

## Goal

Re-evaluate every TypeScript declaration layer in the Vue Clamp source tree instead of defending the
current layout. The review covers package-facing types, source-module helper contracts,
implementation-local types, and test/website consumer types.

## Recommended type layers

Use four explicit layers:

1. Package API types
   - Types consumers can import from `vue-clamp`.
   - Source owner: `packages/vue-clamp/src/types.ts`.
   - Export path: `packages/vue-clamp/src/index.ts`.
   - These names are semver API.

2. Component contract building blocks
   - Private aliases inside `types.ts` that keep package API types consistent.
   - Examples: shared controls, clamped/expanded state, exposed instance shape.
   - They should stay private unless users need a cross-component abstraction.

3. Source-module helper contracts
   - Exported from the behavior module that owns them.
   - Used by sibling modules, tests, or benchmarks through source imports.
   - Not exported from `index.ts` unless they become documented package API.

4. Implementation-local types
   - Solver states, DOM probe shapes, render-only options, benchmark fixtures, and website UI
     helper types.
   - Stay close to the code that owns the behavior.

## Current inventory and assessment

### Package API candidates in `types.ts`

These are correctly package-facing and should remain root exports:

- `ClampBoundary`
  - Public prop value domain for `boundary`.
  - Used by website and tests as a consumer-facing type.
- `LineClampLocation`
  - Public prop value domain for `location`.
  - The runtime accepts finite numbers and normalizes to `0..1`; TypeScript cannot express that
    numeric range without an impractical branded API.
- `LineClampProps`, `RichLineClampProps`, `InlineClampProps`, `WrapClampProps<T>`
  - Public wrapper/component prop contracts.
  - Keep in `types.ts` and root-export them.
- `LineClampSlotProps`, `RichLineClampSlotProps`, `WrapClampSlotProps<T>`
  - Public slot contracts.
  - Concrete per-component names are better than exporting one base type, because future slot
    divergence remains possible.
- `LineClampSlots`, `RichLineClampSlots`, `WrapClampSlots<T>`
  - Declaration-building contracts for Vue `SlotsType`.
  - Keep them out of the root package barrel for now so this cleanup does not introduce a new
    consumer-facing slot-map API.
- Precise `WrapClamp` generic slot support for consuming apps remains a future public API design.
  The raw component runtime prop accepts `readonly unknown[]`, so this cleanup should not add a
  new specializer or cast-based public component type.
- `LineClampExposed`, `RichLineClampExposed`, `WrapClampExposed`
  - Public template-ref instance contracts.
  - Runtime `expose(... satisfies ...)` checks currently keep these aligned with component code.
- `InlineClampParts`, `InlineClampSplit`
  - Public callback contract for the `split` prop.
  - Root export is appropriate because users write this function directly.
- `WrapClampItemKey<T>`, `WrapClampItemSlotProps<T>`
  - Public item identity and item-slot contracts.
  - `WrapClampItemKey<T>` intentionally remains permissive for template string keys and primitive
    arrays; over-typing string keys would make Vue-template usage worse.

Promoted package API value-domain type:

- `ClampLength`
  - The alias describes the public `maxHeight` value domain and is used in public prop interfaces.
  - It is now root-exported so public declarations do not expose an unimportable named alias.

Private building blocks in `types.ts`:

- `ClampControls`, `ClampState`, `ClampSlotProps`, `ClampExposed`
  - These should stay private for now.
  - They remove duplication between public concrete types without forcing a generic cross-component
    abstraction into the package API.

Gap in `types.ts`:

- The file currently acts like a package API registry but also holds at least one source-level
  primitive (`ClampLength`). That is the real design problem; it is not limited to whether one alias
  should be exported.
- The file comment should distinguish package API declarations from private building blocks.
- Slot prop aliases exist, but component implementations do not declare slot maps with Vue
  `SlotsType`, so generated declarations do not describe slot shapes clearly.
- There is no current public API for tying `WrapClamp` slot item types to a concrete `items`
  element type; keep that as a separate design problem.

### Helper contracts in `text.ts`

Current exported helper types:

- `PreparedText`
- `TextClampHint`
- `TextClampResult`

Assessment:

- These belong to `text.ts`, not `types.ts`, because the text module owns boundary preparation,
  warm-start hints, and clamp output.
- They should remain source-module helper contracts, not root package exports.
- `TextClampHint` is a good shared helper contract: both `LineClamp` and `InlineClamp` use the same
  warm-start shape.

Gaps:

- `PreparedText.boundaryOffsets` and `fallbackBoundaryOffsets` are typed as mutable arrays even
  though callers should treat prepared boundary metadata as immutable.
- `TextClampHint` and `TextClampResult` can also be made readonly to reflect their role as search
  snapshots.

Implemented adjustment:

- Change exported text helper contracts to readonly field shapes:
  - `readonly text`
  - `readonly boundary`
  - `readonly boundaryOffsets: readonly number[]`
  - `readonly fallbackBoundaryOffsets?: readonly number[]`
  - readonly `kept` and result `text`

### Helper contracts in `rich.ts`

Current exported helper types:

- `PreparedRich`
- `RichState`

Assessment:

- These belong to `rich.ts`, not `types.ts`, because rich parsing, patching, and structural state are
  owned by the rich helper.
- They should not be root exports.
- `RichLineClamp` needs to store and pass these values; benchmarks also use them to compare direct
  helper performance.

Gaps:

- `PreparedRich` exposes `nodes: readonly PreparedRichNode[]`, but `PreparedRichNode` is private.
  This works as an opaque-ish helper result from `prepareRich`, but it is not a clean exported
  structural contract.
- `RichState` exposes `point: BoundaryPoint`, while `BoundaryPoint` is private. That makes the
  exported type partially unnamed.
- Rich helper states are conceptually snapshots and should be readonly.

Implemented adjustment:

- Export helper-level structural names from `rich.ts` so the helper contract is structurally
  complete while still staying out of the package root.
- Mark rich state/prepared fields readonly where practical.

### Runtime prop helpers in `props.ts`

Current state:

- `boundaryProp`, `locationProp`, and `maxHeightProp` import public value-domain types.
- This is correct because runtime validators and public prop declarations should agree.

Gap:

- If a prop value type is used by runtime prop helpers and public prop interfaces, decide whether it
  is package API or internal helper vocabulary. Do not leave the source owner ambiguous.

### Shared runtime helpers

Modules:

- `layout.ts`
- `native.ts`
- `search.ts`
- `multiline.ts`
- `slot.ts`

Assessment:

- Their local types are mostly correctly local:
  - `LineBox`
  - `NativeClampMode`, `NativeModeInput`
  - `FrameRefs`, `ShellState`, `ShellOptions`
  - inline search callback shapes
- Exported functions can keep private parameter/return helper types when all callers use inference
  and the module is internal-only.

Gap:

- If an exported helper function's return type must be stored or named by a sibling module, promote
  that type to a source-module helper contract. Otherwise keep it local.

### Component-local types

Modules:

- `LineClamp.ts`
- `RichLineClamp.ts`
- `InlineClamp.ts`
- `WrapClamp.ts`

Assessment:

- Component-local DOM/probe/render-state types should stay local:
  - `ProbeElements`
  - `ItemKeyResolver`
  - `SequenceMeasurement`
  - `SequenceMeasurementOptions`
  - `ClampLimits`
  - `Size`
  - `StaticFlowStatus`
  - `StaticFlowEstimate`
  - `StaticFlowEstimateOptions`
- `WrapClamp` solver vocabulary is correctly kept out of `types.ts` because it is not user API.

Gap:

- `ItemKeyResolver` overlaps with the function branch of `WrapClampItemKey<unknown>`. Keeping it
  local is acceptable because runtime resolution intentionally erases item type to `unknown`, but a
  short comment could make that distinction clearer.

### Test and website types

Assessment:

- Browser tests that model consumer usage should import package API types from `src/index.ts`.
- Benchmarks may import helper-module contracts from `text.ts` and `rich.ts`.
- Website code should import only root package types from `vue-clamp`; it currently does.

Gap:

- There is no dedicated type-surface smoke file. `exports.test.ts` checks runtime exports only, so
  type-only drift is caught only incidentally by tests/website imports.

Implemented adjustment:

- Add a lightweight type-only smoke test checked by `vp check` that imports the intended public type
  names from `src/index.ts` and intentionally does not import helper-module contracts.
- Add internal slot-map types and wire component implementations to Vue `SlotsType`.

## Recommended cleanup sequence

1. Rewrite the type organization note in `journey/design.md` so it describes the four layers above.
2. Promote `ClampLength` to the root package API because public props use the named alias.
3. Make text helper contracts readonly.
4. Make rich helper contracts structurally complete within `rich.ts`, then mark snapshot fields
   readonly.
5. Add a type-surface smoke file so `vp check` protects root type exports intentionally.
6. Add internal slot-map contracts for Vue `SlotsType`.
7. Keep precise `WrapClamp` generic slot support out of this cleanup and handle it in a separate
   public API design.
8. Keep solver/probe/state types local unless a real sibling module needs to name them.
