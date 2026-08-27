# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-PKPdqk`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8872.4 |            874.5 |             5.4% |         19.4% |              6.8% |          24.1% |    2473.0 |    16687.8 |  14214.6 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         8873.7 |            489.3 |            10.1% |         25.1% |             12.5% |          31.2% |     926.4 |    16687.1 |  15759.6 |          0 |            0 |                   0 |              668 |            43778 |            0 |           0 |               0 |          0 |

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
| LineClamp | line-pretext-long-token-batch-continuous |     405.8 |       1.6% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jitter     |     385.6 |       1.9% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jitter        |     226.7 |       4.6% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps            |     183.7 |       2.4% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |     155.5 |       1.7% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-continuous |     405.8 |       1.6% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| line-pretext-long-token-batch-jitter     |     385.6 |       1.9% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| line-pretext-english-batch-jitter        |     226.7 |       4.6% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| line-pretext-thai-batch-jumps            |     183.7 |       2.4% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| line-pretext-long-token-batch-jumps      |     155.5 |       1.7% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     385.6 |       1.9% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     405.8 |       1.6% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     385.6 |       1.9% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     405.8 |       1.6% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     385.6 |       1.9% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     405.8 |       1.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     238.1 |       8.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     238.1 |       8.5% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     226.7 |       4.6% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     155.5 |       1.7% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     226.7 |       4.6% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     155.5 |       1.7% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  5600 |     105.9 |      10.1% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  5504 |      58.4 |       5.2% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  4816 |     109.8 |      12.7% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  4576 |     111.9 |      14.2% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  3872 |      93.9 |      12.7% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  3808 |      97.4 |       8.6% |
| LineClamp | line-pretext-thai-batch-continuous       | Mutation records           |  3680 |      93.3 |      12.4% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3618 |     123.8 |      11.2% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3360 |      93.9 |      12.7% |
| LineClamp | line-pretext-english-batch-jitter        | Attribute mutation records |  3360 |     111.9 |      14.2% |
| LineClamp | line-pretext-cjk-batch-continuous        | Attribute mutation records |  3360 |      97.4 |       8.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  3360 |     109.8 |      12.7% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     385.6 |       1.9% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     405.8 |       1.6% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     385.6 |       1.9% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     405.8 |       1.6% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     385.6 |       1.9% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter          | Value | Active ms | Active RME |
| ---------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records |  5600 |     105.9 |      10.1% |
| line-pretext-long-token-batch-jitter     | Mutation records |  5504 |      58.4 |       5.2% |
| line-pretext-cjk-batch-jitter            | Mutation records |  4816 |     109.8 |      12.7% |
| line-pretext-english-batch-jitter        | Mutation records |  4576 |     111.9 |      14.2% |
| line-pretext-english-batch-continuous    | Mutation records |  3872 |      93.9 |      12.7% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |       Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | --------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                 7/12 |      ~-62.5% | 2473.0 -> 926.4 |    -100.0% |               N/A |                     N/A |                -93.8% |         -52.0% |          N/A |         N/A |        N/A |         -0.0% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   156.0 |            93.9 |
| LineClamp | line-pretext-english-batch-jitter        |   226.7 |           111.9 |
| LineClamp | line-pretext-english-batch-jumps         |    97.5 |            40.1 |
| LineClamp | line-pretext-cjk-batch-continuous        |   175.1 |            97.4 |
| LineClamp | line-pretext-cjk-batch-jitter            |   238.1 |           109.8 |
| LineClamp | line-pretext-cjk-batch-jumps             |   103.5 |            30.9 |
| LineClamp | line-pretext-thai-batch-continuous       |   160.8 |            93.3 |
| LineClamp | line-pretext-thai-batch-jitter           |   184.7 |           123.8 |
| LineClamp | line-pretext-thai-batch-jumps            |   183.7 |            37.5 |
| LineClamp | line-pretext-long-token-batch-continuous |   405.8 |           105.9 |
| LineClamp | line-pretext-long-token-batch-jitter     |   385.6 |            58.4 |
| LineClamp | line-pretext-long-token-batch-jumps      |   155.5 |            23.5 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                    ~-39.8% |
| LineClamp | line-pretext-english-batch-jitter        |                    ~-50.6% |
| LineClamp | line-pretext-english-batch-jumps         |                    ~-58.9% |
| LineClamp | line-pretext-cjk-batch-continuous        |                     -44.4% |
| LineClamp | line-pretext-cjk-batch-jitter            |                    ~-53.9% |
| LineClamp | line-pretext-cjk-batch-jumps             |                    ~-70.1% |
| LineClamp | line-pretext-thai-batch-continuous       |                     -42.0% |
| LineClamp | line-pretext-thai-batch-jitter           |                    ~-33.0% |
| LineClamp | line-pretext-thai-batch-jumps            |                     -79.6% |
| LineClamp | line-pretext-long-token-batch-continuous |                     -73.9% |
| LineClamp | line-pretext-long-token-batch-jitter     |                     -84.9% |
| LineClamp | line-pretext-long-token-batch-jumps      |                    ~-84.9% |

## Correctness and comparability notes

The entrypoints are comparable only on the Pretext contract represented here: plain text, an explicit canvas font shorthand, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. The result does not generalize to the root entry's broader layout-authoritative API.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |      Active ms |    Active RME | Confidence                | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | -------------: | ------------: | ------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-long-token-batch-jumps      |      ~-84.9% |  155.5 -> 23.5 | 1.7% -> 24.4% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -68.7% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-long-token-batch-jitter     |       -84.9% |  385.6 -> 58.4 |  1.9% -> 5.2% | normal                    |    -100.0% |               N/A |                     N/A |         -69.1% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-thai-batch-jumps            |       -79.6% |  183.7 -> 37.5 | 2.4% -> 11.8% | normal                    |    -100.0% |               N/A |                     N/A |         -60.1% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-long-token-batch-continuous |       -73.9% | 405.8 -> 105.9 | 1.6% -> 10.1% | normal                    |    -100.0% |               N/A |                     N/A |         -68.2% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-cjk-batch-jumps             |      ~-70.1% |  103.5 -> 30.9 | 8.0% -> 31.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -59.6% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-jumps         |      ~-58.9% |   97.5 -> 40.1 | 9.5% -> 30.7% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -59.1% |          N/A |        N/A |         +0.1% |
| LineClamp | line-pretext-cjk-batch-jitter            |      ~-53.9% | 238.1 -> 109.8 | 8.5% -> 12.7% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -37.8% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-jitter        |      ~-50.6% | 226.7 -> 111.9 | 4.6% -> 14.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -31.9% |          N/A |        N/A |         -0.0% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                     |   Delta |     Value | Active delta | Active confidence         |
| --------- | ------------------------------------- | --------------------------- | ------: | --------: | -----------: | ------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                  | -100.0% | 6080 -> 0 |      ~-39.8% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Child-list mutation records | -100.0% |  288 -> 0 |      ~-39.8% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Added nodes                 | -100.0% |  272 -> 0 |      ~-39.8% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Removed nodes               | -100.0% |  272 -> 0 |      ~-39.8% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                  | -100.0% | 7360 -> 0 |      ~-50.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Child-list mutation records | -100.0% |  608 -> 0 |      ~-50.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Added nodes                 | -100.0% |  608 -> 0 |      ~-50.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Removed nodes               | -100.0% |  608 -> 0 |      ~-50.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                  | -100.0% | 4752 -> 0 |      ~-58.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | Child-list mutation records | -100.0% |  768 -> 0 |      ~-58.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | Added nodes                 | -100.0% |  576 -> 0 |      ~-58.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | Removed nodes               | -100.0% |  576 -> 0 |      ~-58.9% | low (high active-time CV) |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
