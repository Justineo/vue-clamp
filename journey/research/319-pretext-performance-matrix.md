# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-q5WJfI`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8873.3 |            898.4 |             7.2% |         23.2% |              9.0% |          28.8% |    2550.0 |    16687.0 |  14140.5 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         8873.8 |            464.7 |            22.6% |         31.9% |             28.0% |          39.6% |     956.9 |    16684.7 |  15728.8 |          0 |            0 |                   0 |            10688 |            43778 |            0 |           0 |               0 |          0 |

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
| LineClamp | line-pretext-long-token-batch-jitter     |     441.3 |       0.8% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-continuous |     437.2 |       3.4% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |     180.8 |       4.7% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

### current/pretext

| Component | Scenario                           | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-thai-batch-continuous |      59.9 |       3.5% |       5 |          0 |                   0 |             3680 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-jitter     |     441.3 |       0.8% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| line-pretext-long-token-batch-continuous |     437.2 |       3.4% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| line-pretext-long-token-batch-jumps      |     180.8 |       4.7% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                           | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-thai-batch-continuous |      59.9 |       3.5% |       5 |          0 |                   0 |             3680 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     441.3 |       0.8% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     437.2 |       3.4% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     441.3 |       0.8% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     437.2 |       3.4% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     441.3 |       0.8% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     437.2 |       3.4% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     235.4 |      23.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     235.4 |      23.5% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     210.5 |      11.0% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     180.8 |       4.7% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     210.5 |      11.0% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     180.8 |       4.7% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  5600 |     111.9 |      19.2% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  5504 |     125.9 |      27.2% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  4816 |      98.8 |      39.6% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  4576 |     107.1 |      37.6% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  3872 |      97.5 |      20.2% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  3808 |     119.3 |      13.7% |
| LineClamp | line-pretext-thai-batch-continuous       | Mutation records           |  3680 |      59.9 |       3.5% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3618 |     112.5 |      15.5% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3360 |      97.5 |      20.2% |
| LineClamp | line-pretext-english-batch-jitter        | Attribute mutation records |  3360 |     107.1 |      37.6% |
| LineClamp | line-pretext-cjk-batch-continuous        | Attribute mutation records |  3360 |     119.3 |      13.7% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  3360 |      98.8 |      39.6% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     441.3 |       0.8% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     437.2 |       3.4% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     441.3 |       0.8% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     437.2 |       3.4% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     441.3 |       0.8% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter          | Value | Active ms | Active RME |
| ---------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records |  5600 |     111.9 |      19.2% |
| line-pretext-long-token-batch-jitter     | Mutation records |  5504 |     125.9 |      27.2% |
| line-pretext-cjk-batch-jitter            | Mutation records |  4816 |      98.8 |      39.6% |
| line-pretext-english-batch-jitter        | Mutation records |  4576 |     107.1 |      37.6% |
| line-pretext-english-batch-continuous    | Mutation records |  3872 |      97.5 |      20.2% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |       Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | --------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                11/12 |      ~-62.5% | 2550.0 -> 956.9 |    -100.0% |               N/A |                     N/A |                  0.0% |         -52.0% |          N/A |         N/A |        N/A |         -0.0% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   201.3 |            97.5 |
| LineClamp | line-pretext-english-batch-jitter        |   210.5 |           107.1 |
| LineClamp | line-pretext-english-batch-jumps         |    95.2 |            31.8 |
| LineClamp | line-pretext-cjk-batch-continuous        |   172.4 |           119.3 |
| LineClamp | line-pretext-cjk-batch-jitter            |   235.4 |            98.8 |
| LineClamp | line-pretext-cjk-batch-jumps             |    91.7 |            22.2 |
| LineClamp | line-pretext-thai-batch-continuous       |   119.4 |            59.9 |
| LineClamp | line-pretext-thai-batch-jitter           |   195.0 |           112.5 |
| LineClamp | line-pretext-thai-batch-jumps            |   169.8 |            24.5 |
| LineClamp | line-pretext-long-token-batch-continuous |   437.2 |           111.9 |
| LineClamp | line-pretext-long-token-batch-jitter     |   441.3 |           125.9 |
| LineClamp | line-pretext-long-token-batch-jumps      |   180.8 |            45.5 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                    ~-51.6% |
| LineClamp | line-pretext-english-batch-jitter        |                    ~-49.1% |
| LineClamp | line-pretext-english-batch-jumps         |                    ~-66.6% |
| LineClamp | line-pretext-cjk-batch-continuous        |                    ~-30.8% |
| LineClamp | line-pretext-cjk-batch-jitter            |                    ~-58.0% |
| LineClamp | line-pretext-cjk-batch-jumps             |                    ~-75.8% |
| LineClamp | line-pretext-thai-batch-continuous       |                     -49.8% |
| LineClamp | line-pretext-thai-batch-jitter           |                    ~-42.3% |
| LineClamp | line-pretext-thai-batch-jumps            |                    ~-85.6% |
| LineClamp | line-pretext-long-token-batch-continuous |                    ~-74.4% |
| LineClamp | line-pretext-long-token-batch-jitter     |                    ~-71.5% |
| LineClamp | line-pretext-long-token-batch-jumps      |                    ~-74.8% |

## Correctness and comparability notes

The timing comparison covers only the predictive eligibility subset: plain text with controlled CSS typography, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. Other Pretext-entry API combinations dispatch to the same native or measured engines as the root entry and are outside this performance slice.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |      Active ms |     Active RME | Confidence                | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | -------------: | -------------: | ------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-thai-batch-jumps            |      ~-85.6% |  169.8 -> 24.5 |  7.7% -> 32.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -60.1% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-cjk-batch-jumps             |      ~-75.8% |   91.7 -> 22.2 | 16.8% -> 28.8% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -59.6% |          N/A |        N/A |          0.0% |
| LineClamp | line-pretext-long-token-batch-jumps      |      ~-74.8% |  180.8 -> 45.5 |  4.7% -> 36.4% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -68.7% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-long-token-batch-continuous |      ~-74.4% | 437.2 -> 111.9 |  3.4% -> 19.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -68.2% |          N/A |        N/A |         -0.2% |
| LineClamp | line-pretext-long-token-batch-jitter     |      ~-71.5% | 441.3 -> 125.9 |  0.8% -> 27.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -69.1% |          N/A |        N/A |         -0.1% |
| LineClamp | line-pretext-english-batch-jumps         |      ~-66.6% |   95.2 -> 31.8 | 15.8% -> 39.3% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -59.1% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-cjk-batch-jitter            |      ~-58.0% |  235.4 -> 98.8 | 23.5% -> 39.6% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -37.8% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-english-batch-continuous    |      ~-51.6% |  201.3 -> 97.5 | 28.8% -> 20.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -32.8% |          N/A |        N/A |         -0.0% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                     |   Delta |     Value | Active delta | Active confidence         |
| --------- | ------------------------------------- | --------------------------- | ------: | --------: | -----------: | ------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                  | -100.0% | 6080 -> 0 |      ~-51.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Child-list mutation records | -100.0% |  288 -> 0 |      ~-51.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Added nodes                 | -100.0% |  272 -> 0 |      ~-51.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-continuous | Removed nodes               | -100.0% |  272 -> 0 |      ~-51.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                  | -100.0% | 7360 -> 0 |      ~-49.1% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Child-list mutation records | -100.0% |  608 -> 0 |      ~-49.1% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Added nodes                 | -100.0% |  608 -> 0 |      ~-49.1% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Removed nodes               | -100.0% |  608 -> 0 |      ~-49.1% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                  | -100.0% | 4752 -> 0 |      ~-66.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | Child-list mutation records | -100.0% |  768 -> 0 |      ~-66.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | Added nodes                 | -100.0% |  576 -> 0 |      ~-66.6% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | Removed nodes               | -100.0% |  576 -> 0 |      ~-66.6% | low (high active-time CV) |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
