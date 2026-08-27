# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-hSgirL`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8866.6 |           1011.4 |             9.7% |         38.8% |             12.0% |          48.2% |    2482.0 |    16698.4 |  14217.0 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         8865.3 |            485.1 |            10.7% |         51.1% |             13.3% |          63.4% |    1095.4 |    16946.8 |  15836.3 |          0 |            0 |                   0 |              700 |            48118 |            0 |           0 |               0 |          0 |

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

| Component | Scenario                             | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ------------------------------------ | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-long-token-batch-jitter |     473.4 |       3.7% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps        |     204.4 |       4.4% |       5 |       4688 |                   0 |             5136 |            0 |           0 |

### current/pretext

| Component | Scenario                           | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-thai-batch-jumps      |      66.8 |       3.7% |       5 |          0 |                   0 |             3216 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-continuous |      51.4 |       4.5% |       5 |          0 |                   0 |             3776 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                             | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ------------------------------------ | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-jitter |     473.4 |       3.7% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| line-pretext-thai-batch-jumps        |     204.4 |       4.4% |       5 |       4688 |                   0 |             5136 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                           | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-thai-batch-jumps      |      66.8 |       3.7% |       5 |          0 |                   0 |             3216 |            0 |           0 |
| line-pretext-thai-batch-continuous |      51.4 |       4.5% |       5 |          0 |                   0 |             3776 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     473.4 |       3.7% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     383.7 |       8.5% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     473.4 |       3.7% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     383.7 |       8.5% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     473.4 |       3.7% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     383.7 |       8.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     226.4 |      19.2% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     226.4 |      19.2% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     211.9 |      18.4% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     185.2 |      13.2% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     211.9 |      18.4% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     185.2 |      13.2% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  5584 |      46.9 |      63.4% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  5488 |     133.4 |      16.8% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  5152 |     119.9 |      10.8% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  4560 |      99.8 |      35.8% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  3968 |     104.0 |      10.2% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  3904 |      44.9 |      48.1% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3894 |     131.7 |      15.9% |
| LineClamp | line-pretext-thai-batch-continuous       | Mutation records           |  3776 |      51.4 |       4.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  3696 |     119.9 |      10.8% |
| LineClamp | line-pretext-thai-batch-jitter           | Attribute mutation records |  3636 |     131.7 |      15.9% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3456 |     104.0 |      10.2% |
| LineClamp | line-pretext-cjk-batch-continuous        | Attribute mutation records |  3456 |      44.9 |      48.1% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     473.4 |       3.7% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     383.7 |       8.5% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     473.4 |       3.7% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     383.7 |       8.5% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     473.4 |       3.7% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter          | Value | Active ms | Active RME |
| ---------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records |  5584 |      46.9 |      63.4% |
| line-pretext-long-token-batch-jitter     | Mutation records |  5488 |     133.4 |      16.8% |
| line-pretext-cjk-batch-jitter            | Mutation records |  5152 |     119.9 |      10.8% |
| line-pretext-english-batch-jitter        | Mutation records |  4560 |      99.8 |      35.8% |
| line-pretext-english-batch-continuous    | Mutation records |  3968 |     104.0 |      10.2% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |        Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | ---------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                 9/12 |      ~-55.9% | 2482.0 -> 1095.4 |    -100.0% |               N/A |                     N/A |                -93.5% |         -47.3% |          N/A |         N/A |        N/A |         +1.5% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   193.7 |           104.0 |
| LineClamp | line-pretext-english-batch-jitter        |   211.9 |            99.8 |
| LineClamp | line-pretext-english-batch-jumps         |   104.7 |           125.2 |
| LineClamp | line-pretext-cjk-batch-continuous        |   102.7 |            44.9 |
| LineClamp | line-pretext-cjk-batch-jitter            |   226.4 |           119.9 |
| LineClamp | line-pretext-cjk-batch-jumps             |    86.3 |            51.5 |
| LineClamp | line-pretext-thai-batch-continuous       |   111.5 |            51.4 |
| LineClamp | line-pretext-thai-batch-jitter           |   198.1 |           131.7 |
| LineClamp | line-pretext-thai-batch-jumps            |   204.4 |            66.8 |
| LineClamp | line-pretext-long-token-batch-continuous |   383.7 |            46.9 |
| LineClamp | line-pretext-long-token-batch-jitter     |   473.4 |           133.4 |
| LineClamp | line-pretext-long-token-batch-jumps      |   185.2 |           119.9 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                    ~-46.3% |
| LineClamp | line-pretext-english-batch-jitter        |                    ~-52.9% |
| LineClamp | line-pretext-english-batch-jumps         |                     +19.6% |
| LineClamp | line-pretext-cjk-batch-continuous        |                    ~-56.3% |
| LineClamp | line-pretext-cjk-batch-jitter            |                    ~-47.0% |
| LineClamp | line-pretext-cjk-batch-jumps             |                    ~-40.3% |
| LineClamp | line-pretext-thai-batch-continuous       |                     -53.9% |
| LineClamp | line-pretext-thai-batch-jitter           |                    ~-33.5% |
| LineClamp | line-pretext-thai-batch-jumps            |                     -67.3% |
| LineClamp | line-pretext-long-token-batch-continuous |                    ~-87.8% |
| LineClamp | line-pretext-long-token-batch-jitter     |                    ~-71.8% |
| LineClamp | line-pretext-long-token-batch-jumps      |                    ~-35.3% |

## Correctness and comparability notes

The entrypoints are comparable only on the Pretext contract represented here: plain text, an explicit canvas font shorthand, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. The result does not generalize to the root entry's broader layout-authoritative API.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |      Active ms |     Active RME | Confidence                                                  | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | -------------: | -------------: | ----------------------------------------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-long-token-batch-continuous |      ~-87.8% |  383.7 -> 46.9 |  8.5% -> 63.4% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -68.3% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-long-token-batch-jitter     |      ~-71.8% | 473.4 -> 133.4 |  3.7% -> 16.8% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -69.2% |          N/A |        N/A |         -0.3% |
| LineClamp | line-pretext-thai-batch-jumps            |       -67.3% |  204.4 -> 66.8 |   4.4% -> 3.7% | normal                                                      |    -100.0% |               N/A |                     N/A |         -37.4% |          N/A |        N/A |         +4.9% |
| LineClamp | line-pretext-cjk-batch-continuous        |      ~-56.3% |  102.7 -> 44.9 | 48.2% -> 48.1% | low (high active-time CV; overlapping active-time mean MOE) |    -100.0% |               N/A |                     N/A |         -20.5% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-thai-batch-continuous       |       -53.9% |  111.5 -> 51.4 |   5.1% -> 4.5% | normal                                                      |    -100.0% |               N/A |                     N/A |         -10.9% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-jitter        |      ~-52.9% |  211.9 -> 99.8 | 18.4% -> 35.8% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -32.1% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-cjk-batch-jitter            |      ~-47.0% | 226.4 -> 119.9 | 19.2% -> 10.8% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -33.5% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-continuous    |      ~-46.3% | 193.7 -> 104.0 | 13.4% -> 10.2% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -31.1% |          N/A |        N/A |         -0.0% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                     |   Delta |     Value | Active delta | Active confidence                                           |
| --------- | ------------------------------------- | --------------------------- | ------: | --------: | -----------: | ----------------------------------------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                  | -100.0% | 6080 -> 0 |      ~-46.3% | low (high active-time CV)                                   |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                  | -100.0% | 7360 -> 0 |      ~-52.9% | low (high active-time CV)                                   |
| LineClamp | line-pretext-english-batch-jitter     | Child-list mutation records | -100.0% |  608 -> 0 |      ~-52.9% | low (high active-time CV)                                   |
| LineClamp | line-pretext-english-batch-jitter     | Added nodes                 | -100.0% |  608 -> 0 |      ~-52.9% | low (high active-time CV)                                   |
| LineClamp | line-pretext-english-batch-jitter     | Removed nodes               | -100.0% |  608 -> 0 |      ~-52.9% | low (high active-time CV)                                   |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                  | -100.0% | 4752 -> 0 |       +19.6% | normal                                                      |
| LineClamp | line-pretext-cjk-batch-continuous     | BBox reads                  | -100.0% | 5232 -> 0 |      ~-56.3% | low (high active-time CV; overlapping active-time mean MOE) |
| LineClamp | line-pretext-cjk-batch-jitter         | BBox reads                  | -100.0% | 7712 -> 0 |      ~-47.0% | low (high active-time CV)                                   |
| LineClamp | line-pretext-cjk-batch-jumps          | BBox reads                  | -100.0% | 4688 -> 0 |      ~-40.3% | low (high active-time CV; overlapping active-time mean MOE) |
| LineClamp | line-pretext-thai-batch-continuous    | BBox reads                  | -100.0% | 4677 -> 0 |       -53.9% | normal                                                      |
| LineClamp | line-pretext-thai-batch-jitter        | BBox reads                  | -100.0% | 4852 -> 0 |      ~-33.5% | low (high active-time CV)                                   |
| LineClamp | line-pretext-thai-batch-jumps         | BBox reads                  | -100.0% | 4688 -> 0 |       -67.3% | normal                                                      |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
