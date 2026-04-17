# 260 Rich benchmark regression check

## Result

Compared `4472dfe` (`refactor: simplify clamp recomputation and rich image tracking`) against its
parent `b8fd530` (`fix: stop rich fallback reclamp loop`) using the existing rich benchmark:

```sh
vp run benchmark:rich
```

The benchmark was run once on each revision. Each benchmark run already includes one warmup pass
and four measured passes per scenario, and reports medians across those measured passes.

## Median comparison

| Scenario                 | Commit    | Total ms | Mean step ms | `getBoundingClientRect` | `getClientRects` | `replaceChildren` |
| ------------------------ | --------- | -------: | -----------: | ----------------------: | ---------------: | ----------------: |
| `fit-width-sweep`        | `4472dfe` |   `0.25` |    `0.03125` |                     `8` |              `8` |               `0` |
| `fit-width-sweep`        | `b8fd530` |   `0.30` |    `0.03750` |                     `8` |              `8` |               `0` |
| `truncate-width-sweep`   | `4472dfe` |    `2.5` |     `0.3125` |                     `8` |             `77` |              `71` |
| `truncate-width-sweep`   | `b8fd530` |    `2.6` |     `0.3250` |                     `8` |             `77` |              `71` |
| `dense-grid-width-sweep` | `4472dfe` |   `71.5` |    `11.9167` |                   `240` |           `1890` |            `1767` |
| `dense-grid-width-sweep` | `b8fd530` |   `75.4` |    `12.5667` |                   `240` |           `1890` |            `1767` |

## Conclusion

- No regression showed up in the existing rich benchmark.
- The tracked DOM work counts stayed exactly the same in all scenarios.
- Median runtime improved slightly on the new revision:
  - `fit-width-sweep`: about `16.7%` lower total time
  - `truncate-width-sweep`: about `3.8%` lower total time
  - `dense-grid-width-sweep`: about `5.2%` lower total time
- Given the small absolute times in the light scenarios, treat the `fit-width-sweep` and
  `truncate-width-sweep` gains as directional rather than definitive. The denser scenario is the
  more useful signal, and it also improved modestly.
