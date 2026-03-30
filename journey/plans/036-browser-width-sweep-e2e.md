# Browser Width Sweep E2E

## Goal

Add a real browser test that sweeps container width 1px at a time and proves the collapsed clamp output never exceeds the allowed visible line count during shrink and grow transitions.

## Why

- jsdom tests cannot catch real browser line wrapping regressions.
- The benchmark preview already surfaced at least one case where the Pretext path can show 4 visible rows while configured for 3.
- This needs runtime validation against actual layout, not just engine math.

## Scope

1. Add a minimal browser test project alongside the existing jsdom project.
2. Keep browser coverage narrow: only the clamp width-sweep regression path for now.
3. Use Chromium via the built-in Vitest browser Playwright provider so the test stays under `vp test`.
4. Mount the real Vue component, not a synthetic engine-only fixture.
5. Sweep width 1px at a time in both directions and assert the visible line count never exceeds the configured limit.
6. Include at least one representative real-world case from the benchmark data.
7. If the test exposes a real bug, fix production code and keep the new browser test as regression coverage.

## Implementation Steps

1. Update test config to use two test projects:
   - jsdom unit/component tests
   - browser e2e tests
2. Add the minimal browser runtime dependency and provider config.
3. Add a browser test helper for:
   - waiting for clamp settlement after width changes
   - counting visible lines from real DOM rects
4. Implement a width-sweep test for a representative 3-line clamp case.
5. Expand to a second scenario if needed to cover slot interaction or the known benchmark failure shape.
6. Fix runtime behavior if the invariant fails.
7. Run `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.

## Acceptance

- Browser test runs under the repo’s normal test workflow.
- Width sweep is 1px granular in both shrink and grow directions.
- The test asserts the rendered line count never exceeds the required clamp limit at any step.
- Any discovered runtime bug is fixed in production code, not hidden in the test.
