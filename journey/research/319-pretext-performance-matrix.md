# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-QOsjaE`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8873.3 |            687.9 |             1.2% |         11.0% |              1.5% |          13.7% |    2142.4 |    16689.4 |  14544.3 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         8873.5 |            280.6 |             1.8% |         14.8% |              2.3% |          18.3% |     557.2 |    16692.6 |  16130.6 |          0 |            0 |                   0 |              668 |            43778 |            0 |           0 |               0 |          0 |

## Width profile matrix

This describes the executed width input shape for each scenario. Width assignments count every write, including writes inside a burst; steps count the stable waits that are measured.

| Component | Scenario                                 | Steps | Width assignments | Unique widths | Repeated assignments | Repeated transitions | Large deltas (>32px) | Max delta |
| --------- | ---------------------------------------- | ----: | ----------------: | ------------: | -------------------: | -------------------: | -------------------: | --------: |
| LineClamp | line-pretext-english-batch-continuous    |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-english-batch-jitter        |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-english-batch-jumps         |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-cjk-batch-continuous        |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-cjk-batch-jitter            |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-cjk-batch-jumps             |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-thai-batch-continuous       |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-thai-batch-jitter           |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-thai-batch-jumps            |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-long-token-batch-continuous |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-long-token-batch-jitter     |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-long-token-batch-jumps      |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |

## Top low-noise active hotspots by target

Rows are sorted by median active time and limited to active RME <= 5.0%. Structural columns are `N/A` when counter tracking was disabled for that target.

### current

| Component | Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-long-token-batch-continuous |     408.6 |       0.6% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jitter     |     402.5 |       1.0% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps            |     188.6 |       2.9% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| LineClamp | line-pretext-cjk-batch-jitter            |     178.2 |       1.6% |       5 |       7712 |                   0 |             7744 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |     161.1 |       1.1% |       5 |       6176 |                   0 |             6896 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jitter        |     144.3 |       0.9% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jitter           |     124.1 |       0.8% |       5 |       4852 |                   0 |             4381 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-continuous       |     122.6 |       1.4% |       5 |       4677 |                   0 |             4236 |            0 |           0 |
| LineClamp | line-pretext-cjk-batch-continuous        |     109.1 |       1.7% |       5 |       5232 |                   0 |             4912 |            0 |           0 |
| LineClamp | line-pretext-cjk-batch-jumps             |      96.4 |       1.9% |       5 |       4688 |                   0 |             5072 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jumps         |      82.2 |       2.3% |       5 |       4752 |                   0 |             5008 |            0 |           0 |

### current/pretext

| Component | Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-thai-batch-jitter           |      65.4 |       1.6% |       5 |          0 |                   0 |             3618 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-continuous       |      60.6 |       1.5% |       5 |          0 |                   0 |             3680 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-continuous |      58.7 |       2.1% |       5 |          0 |                   0 |             5600 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jitter     |      58.2 |       1.7% |       5 |          0 |                   0 |             5504 |            0 |           0 |
| LineClamp | line-pretext-cjk-batch-jitter            |      56.8 |       1.5% |       5 |          0 |                   0 |             4816 |            0 |           0 |
| LineClamp | line-pretext-english-batch-continuous    |      55.0 |       3.2% |       5 |          0 |                   0 |             3872 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jitter        |      54.6 |       2.5% |       5 |          0 |                   0 |             4576 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps            |      25.2 |       3.3% |       5 |          0 |                   0 |             2048 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |      23.2 |       1.9% |       5 |          0 |                   0 |             2160 |            0 |           0 |
| LineClamp | line-pretext-cjk-batch-jumps             |      22.6 |       3.5% |       5 |          0 |                   0 |             2048 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jumps         |      21.9 |       3.4% |       5 |          0 |                   0 |             2048 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-continuous |     408.6 |       0.6% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| line-pretext-long-token-batch-jitter     |     402.5 |       1.0% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| line-pretext-thai-batch-jumps            |     188.6 |       2.9% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| line-pretext-cjk-batch-jitter            |     178.2 |       1.6% |       5 |       7712 |                   0 |             7744 |            0 |           0 |
| line-pretext-long-token-batch-jumps      |     161.1 |       1.1% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-thai-batch-jitter           |      65.4 |       1.6% |       5 |          0 |                   0 |             3618 |            0 |           0 |
| line-pretext-thai-batch-continuous       |      60.6 |       1.5% |       5 |          0 |                   0 |             3680 |            0 |           0 |
| line-pretext-long-token-batch-continuous |      58.7 |       2.1% |       5 |          0 |                   0 |             5600 |            0 |           0 |
| line-pretext-long-token-batch-jitter     |      58.2 |       1.7% |       5 |          0 |                   0 |             5504 |            0 |           0 |
| line-pretext-cjk-batch-jitter            |      56.8 |       1.5% |       5 |          0 |                   0 |             4816 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     402.5 |       1.0% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     408.6 |       0.6% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     402.5 |       1.0% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     408.6 |       0.6% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     402.5 |       1.0% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     408.6 |       0.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     178.2 |       1.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     178.2 |       1.6% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     144.3 |       0.9% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     161.1 |       1.1% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     144.3 |       0.9% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     161.1 |       1.1% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  5600 |      58.7 |       2.1% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  5504 |      58.2 |       1.7% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  4816 |      56.8 |       1.5% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  4576 |      54.6 |       2.5% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  3872 |      55.0 |       3.2% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  3808 |      55.0 |      18.3% |
| LineClamp | line-pretext-thai-batch-continuous       | Mutation records           |  3680 |      60.6 |       1.5% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3618 |      65.4 |       1.6% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3360 |      55.0 |       3.2% |
| LineClamp | line-pretext-english-batch-jitter        | Attribute mutation records |  3360 |      54.6 |       2.5% |
| LineClamp | line-pretext-cjk-batch-continuous        | Attribute mutation records |  3360 |      55.0 |      18.3% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  3360 |      56.8 |       1.5% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     402.5 |       1.0% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     408.6 |       0.6% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     402.5 |       1.0% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     408.6 |       0.6% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     402.5 |       1.0% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter          | Value | Active ms | Active RME |
| ---------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records |  5600 |      58.7 |       2.1% |
| line-pretext-long-token-batch-jitter     | Mutation records |  5504 |      58.2 |       1.7% |
| line-pretext-cjk-batch-jitter            | Mutation records |  4816 |      56.8 |       1.5% |
| line-pretext-english-batch-jitter        | Mutation records |  4576 |      54.6 |       2.5% |
| line-pretext-english-batch-continuous    | Mutation records |  3872 |      55.0 |       3.2% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |       Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | --------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                 2/12 |      ~-74.0% | 2142.4 -> 557.2 |    -100.0% |               N/A |                     N/A |                -93.8% |         -52.0% |          N/A |         N/A |        N/A |         +0.0% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   124.7 |            55.0 |
| LineClamp | line-pretext-english-batch-jitter        |   144.3 |            54.6 |
| LineClamp | line-pretext-english-batch-jumps         |    82.2 |            21.9 |
| LineClamp | line-pretext-cjk-batch-continuous        |   109.1 |            55.0 |
| LineClamp | line-pretext-cjk-batch-jitter            |   178.2 |            56.8 |
| LineClamp | line-pretext-cjk-batch-jumps             |    96.4 |            22.6 |
| LineClamp | line-pretext-thai-batch-continuous       |   122.6 |            60.6 |
| LineClamp | line-pretext-thai-batch-jitter           |   124.1 |            65.4 |
| LineClamp | line-pretext-thai-batch-jumps            |   188.6 |            25.2 |
| LineClamp | line-pretext-long-token-batch-continuous |   408.6 |            58.7 |
| LineClamp | line-pretext-long-token-batch-jitter     |   402.5 |            58.2 |
| LineClamp | line-pretext-long-token-batch-jumps      |   161.1 |            23.2 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                    ~-55.9% |
| LineClamp | line-pretext-english-batch-jitter        |                     -62.2% |
| LineClamp | line-pretext-english-batch-jumps         |                     -73.4% |
| LineClamp | line-pretext-cjk-batch-continuous        |                    ~-49.6% |
| LineClamp | line-pretext-cjk-batch-jitter            |                     -68.1% |
| LineClamp | line-pretext-cjk-batch-jumps             |                     -76.6% |
| LineClamp | line-pretext-thai-batch-continuous       |                     -50.6% |
| LineClamp | line-pretext-thai-batch-jitter           |                     -47.3% |
| LineClamp | line-pretext-thai-batch-jumps            |                     -86.6% |
| LineClamp | line-pretext-long-token-batch-continuous |                     -85.6% |
| LineClamp | line-pretext-long-token-batch-jitter     |                     -85.5% |
| LineClamp | line-pretext-long-token-batch-jumps      |                     -85.6% |

## Correctness and comparability notes

The timing comparison covers only the predictive eligibility subset: plain text, an explicit canvas font shorthand, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. Other Pretext-entry API combinations dispatch to the same native or measured engines as the root entry and are outside this performance slice.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |     Active ms |   Active RME | Confidence | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | ------------: | -----------: | ---------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-thai-batch-jumps            |       -86.6% | 188.6 -> 25.2 | 2.9% -> 3.3% | normal     |    -100.0% |               N/A |                     N/A |         -60.1% |          N/A |        N/A |          0.0% |
| LineClamp | line-pretext-long-token-batch-continuous |       -85.6% | 408.6 -> 58.7 | 0.6% -> 2.1% | normal     |    -100.0% |               N/A |                     N/A |         -68.2% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-long-token-batch-jumps      |       -85.6% | 161.1 -> 23.2 | 1.1% -> 1.9% | normal     |    -100.0% |               N/A |                     N/A |         -68.7% |          N/A |        N/A |          0.0% |
| LineClamp | line-pretext-long-token-batch-jitter     |       -85.5% | 402.5 -> 58.2 | 1.0% -> 1.7% | normal     |    -100.0% |               N/A |                     N/A |         -69.1% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-cjk-batch-jumps             |       -76.6% |  96.4 -> 22.6 | 1.9% -> 3.5% | normal     |    -100.0% |               N/A |                     N/A |         -59.6% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-english-batch-jumps         |       -73.4% |  82.2 -> 21.9 | 2.3% -> 3.4% | normal     |    -100.0% |               N/A |                     N/A |         -59.1% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-cjk-batch-jitter            |       -68.1% | 178.2 -> 56.8 | 1.6% -> 1.5% | normal     |    -100.0% |               N/A |                     N/A |         -37.8% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-english-batch-jitter        |       -62.2% | 144.3 -> 54.6 | 0.9% -> 2.5% | normal     |    -100.0% |               N/A |                     N/A |         -31.9% |          N/A |        N/A |         +0.1% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                     |   Delta |     Value | Active delta | Active confidence         |
| --------- | ------------------------------------- | --------------------------- | ------: | --------: | -----------: | ------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                  | -100.0% | 6080 -> 0 |      ~-55.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Child-list mutation records | -100.0% |  288 -> 0 |      ~-55.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Added nodes                 | -100.0% |  272 -> 0 |      ~-55.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Removed nodes               | -100.0% |  272 -> 0 |      ~-55.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                  | -100.0% | 7360 -> 0 |       -62.2% | normal                    |
| LineClamp | line-pretext-english-batch-jitter     | Child-list mutation records | -100.0% |  608 -> 0 |       -62.2% | normal                    |
| LineClamp | line-pretext-english-batch-jitter     | Added nodes                 | -100.0% |  608 -> 0 |       -62.2% | normal                    |
| LineClamp | line-pretext-english-batch-jitter     | Removed nodes               | -100.0% |  608 -> 0 |       -62.2% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                  | -100.0% | 4752 -> 0 |       -73.4% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | Child-list mutation records | -100.0% |  768 -> 0 |       -73.4% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | Added nodes                 | -100.0% |  576 -> 0 |       -73.4% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | Removed nodes               | -100.0% |  576 -> 0 |       -73.4% | normal                    |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
