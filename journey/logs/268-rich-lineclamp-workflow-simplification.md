# RichLineClamp workflow simplification

Date: 2026-04-17

## Notes

- Removed the separate visible rich HTML wrapper/ref from `RichLineClamp`; the shared `bodyRef`
  is now the visible rich patch target.
- Collapsed the hidden probe shape from `content -> body -> rich` to `content -> body`, matching
  the visible flow and removing one extra probe element from the internal contract.
- Renamed the component-local reset/apply helpers to match the simpler `LineClamp` workflow.
- Updated the browser test helper so rich content resolves to the `body` part directly.
- Updated the rich benchmark host to use the same direct `body` rich target as the component.

## Benchmark comparison

Ran `vp run benchmark:rich` once with the old benchmark host shape (`content -> body -> rich`) and
once after aligning the host with the component shape (`content -> body`).

| Scenario                 | Old host total | Direct body total | Difference | Direct body churn             |
| ------------------------ | -------------: | ----------------: | ---------: | ----------------------------- |
| `fit-width-sweep`        |       `0.15ms` |          `0.20ms` |  `+0.05ms` | `0` replace / `0` image clone |
| `truncate-width-sweep`   |       `1.55ms` |          `1.50ms` |  `-0.05ms` | `0` replace / `0` image clone |
| `dense-grid-width-sweep` |      `44.60ms` |         `42.15ms` |  `-2.45ms` | `0` replace / `0` image clone |

## Validation

- `vp check`
- `vp test`
- `vp run test:browser`
- `vp run benchmark:rich`
