# WrapClamp settled-layout-signature evaluation

## Question

- Is `settledLayoutSignature` in `WrapClamp` actually doing useful work, or is it dead defensive complexity?

## Method

- Ran the current browser benchmark as baseline.
- Temporarily removed the `layoutSignature() !== settledLayoutSignature` check from the `ResizeObserver` callback so every observer notification queued a recompute.
- Reran the same benchmark.
- Restored the original implementation.

## Result

- Baseline with settled-signature guard:
  - single-line:
    - `129.5ms` median total
    - `8.09ms` median step
    - `176` rect reads
    - `68` item slot calls
  - table:
    - `310.3ms` median total
    - `38.79ms` median step
    - `16700` rect reads
    - `15300` item slot calls
- Without the guard:
  - single-line:
    - `127.7ms` median total
    - `7.98ms` median step
    - `212` rect reads
    - `76` item slot calls
  - table:
    - `392.9ms` median total
    - `49.11ms` median step
    - `28300` rect reads
    - `23300` item slot calls

## Conclusion

- The guard is working.
- In the single-line case it mostly reduces redundant work but does not move elapsed time much.
- In the table case it is clearly valuable:
  - about `69%` more rect reads without it
  - about `52%` more item slot calls without it
  - about `26.6%` slower total benchmark time without it
- So `settledLayoutSignature` is still complexity worth keeping in the current observer model.
