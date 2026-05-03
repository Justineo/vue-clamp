# Module contract full scan

## Goal

Review all internal module-to-module and module-local contracts in `packages/vue-clamp/src` and remove avoidable complexity without changing public behavior.

## Scope

- Public barrel: keep `index.ts` limited to supported public components and declaration types.
- Shared modules: verify `layout.ts`, `multiline.ts`, `props.ts`, `search.ts`, `slot.ts`, `text.ts`, and `rich.ts` expose only contracts needed by component modules or tests.
- Component modules: check whether helper names, object inputs, and state contracts are still smaller than the positional or diagnostic contracts they replaced.
- Tests/benchmarks: keep internal helper usage aligned with the simplified contracts.

## Constraints

- Do not change the public package API unless the scan finds an accidental leak.
- Preserve current runtime behavior, including rich fallback-to-source behavior for unsupported layout.
- Prefer deleting thin abstractions and diagnostic-only contracts over moving them around.

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run build`
