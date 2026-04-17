# WrapClamp observer simplification

## Attempt

- Replaced the settled-layout-signature path with direct per-target settled sizes.
- Synced observed elements explicitly in `onMounted` / `onUpdated`.
- Removed the `watchPostEffect` observer setup.

## Result

- The rewrite was functionally correct, but not an improvement.
- Browser benchmark with the rewrite:
  - single-line:
    - `128.8ms` median total
    - `8.05ms` median step
    - `176` rect reads
  - table:
    - `321.7ms` median total
    - `40.21ms` median step
    - `16700` rect reads
- Current settled-signature baseline:
  - single-line:
    - `129.5ms` median total
    - `8.09ms` median step
    - `176` rect reads
  - table:
    - `310.3ms` median total
    - `38.79ms` median step
    - `16700` rect reads

## Decision

- Reverted the rewrite.
- It added code and kept the same work counters while making the heavier table benchmark slower.
- Keep the existing settled-layout-signature implementation until there is a simpler change with a measurable win.
