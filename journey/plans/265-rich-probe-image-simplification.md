# 265 Rich probe image simplification

## Goal

Simplify the latest rich probe image patch without changing the behavior.

## Scope

- Keep hidden-probe images on an inert data URI source.
- Keep visible rich images untouched.
- Remove non-essential plumbing from the patch clone path.
- Preserve the existing benchmark and browser-test coverage.

## Benchmark comparison

Ran `vp run benchmark:rich` against:

- `4472dfe` previous rich image tracking version.
- `cb2faeb` structural patch version.
- Current working tree after probe image simplification.

Median total time:

| Scenario                 | `4472dfe` | `cb2faeb` |   Current | Current vs `4472dfe` | Current vs `cb2faeb` |
| ------------------------ | --------: | --------: | --------: | -------------------: | -------------------: |
| `fit-width-sweep`        |  `0.20ms` |  `0.20ms` |  `0.20ms` |                 same |                 same |
| `truncate-width-sweep`   |  `2.55ms` |  `2.10ms` |  `1.55ms` |             `-39.2%` |             `-26.2%` |
| `dense-grid-width-sweep` | `70.00ms` | `50.10ms` | `43.35ms` |             `-38.1%` |             `-13.5%` |

DOM churn:

| Scenario                 | `4472dfe` `replaceChildren` | `cb2faeb` `replaceChildren` | Current `replaceChildren` | Current `cloneNode` | Current image clone |
| ------------------------ | --------------------------: | --------------------------: | ------------------------: | ------------------: | ------------------: |
| `fit-width-sweep`        |                         `0` |                         `0` |                       `0` |                 `0` |                 `0` |
| `truncate-width-sweep`   |                        `71` |                         `0` |                       `0` |                `34` |                 `0` |
| `dense-grid-width-sweep` |                      `1767` |                         `0` |                       `0` |                `40` |                 `0` |

The important signal is that the current version keeps the structural patch win from `cb2faeb`,
keeps `replaceChildren` at zero during measured reclamps, and avoids cloning image nodes in all
measured scenarios.
