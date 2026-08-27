# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-1uD7AE`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8855.5 |            884.5 |             3.9% |          9.3% |              4.8% |          11.6% |    2657.3 |    16693.0 |  14048.9 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         8867.1 |            479.2 |             7.6% |         17.8% |              9.4% |          22.1% |    1167.4 |    16942.1 |  15762.3 |          0 |            0 |                   0 |              700 |            52635 |            0 |           0 |               0 |          0 |

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
| LineClamp | line-pretext-long-token-batch-continuous |     471.8 |       3.6% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jitter     |     460.0 |       2.9% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps            |     201.0 |       1.4% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jitter        |     195.4 |       3.7% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| LineClamp | line-pretext-cjk-batch-jumps             |     118.8 |       4.4% |       5 |       4688 |                   0 |             5072 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jumps         |     106.2 |       3.6% |       5 |       4752 |                   0 |             5008 |            0 |           0 |

### current/pretext

| Component | Scenario                         | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | -------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-english-batch-jumps |     122.6 |       2.8% |       5 |          0 |                   0 |             3216 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps    |      64.5 |       4.1% |       5 |          0 |                   0 |             3216 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-continuous |     471.8 |       3.6% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| line-pretext-long-token-batch-jitter     |     460.0 |       2.9% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| line-pretext-thai-batch-jumps            |     201.0 |       1.4% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| line-pretext-english-batch-jitter        |     195.4 |       3.7% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| line-pretext-cjk-batch-jumps             |     118.8 |       4.4% |       5 |       4688 |                   0 |             5072 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                         | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| -------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-english-batch-jumps |     122.6 |       2.8% |       5 |          0 |                   0 |             3216 |            0 |           0 |
| line-pretext-thai-batch-jumps    |      64.5 |       4.1% |       5 |          0 |                   0 |             3216 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     460.0 |       2.9% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     471.8 |       3.6% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     460.0 |       2.9% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     471.8 |       3.6% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     460.0 |       2.9% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     471.8 |       3.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     230.7 |       6.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     230.7 |       6.5% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     195.4 |       3.7% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     179.1 |       5.2% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     195.4 |       3.7% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     179.1 |       5.2% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  6720 |     109.5 |       9.7% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  6576 |     110.7 |      12.7% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  5792 |      99.1 |      22.1% |
| LineClamp | line-pretext-long-token-batch-continuous | Attribute mutation records |  5600 |     109.5 |       9.7% |
| LineClamp | line-pretext-long-token-batch-jitter     | Attribute mutation records |  5504 |     110.7 |      12.7% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  5184 |      88.5 |      11.0% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  4944 |      99.1 |      22.1% |
| LineClamp | line-pretext-english-batch-jitter        | Attribute mutation records |  4576 |      88.5 |      11.0% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  4192 |      96.9 |       5.4% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  4096 |      94.6 |      12.5% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3931 |     104.5 |      15.3% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3904 |      96.9 |       5.4% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     460.0 |       2.9% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     471.8 |       3.6% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     460.0 |       2.9% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     471.8 |       3.6% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     460.0 |       2.9% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter                    | Value | Active ms | Active RME |
| ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records           |  6720 |     109.5 |       9.7% |
| line-pretext-long-token-batch-jitter     | Mutation records           |  6576 |     110.7 |      12.7% |
| line-pretext-cjk-batch-jitter            | Mutation records           |  5792 |      99.1 |      22.1% |
| line-pretext-long-token-batch-continuous | Attribute mutation records |  5600 |     109.5 |       9.7% |
| line-pretext-long-token-batch-jitter     | Attribute mutation records |  5504 |     110.7 |      12.7% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |        Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | ---------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                 4/12 |      ~-56.1% | 2657.3 -> 1167.4 |    -100.0% |               N/A |                     N/A |                -93.5% |         -42.3% |          N/A |         N/A |        N/A |         +1.5% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   172.2 |            96.9 |
| LineClamp | line-pretext-english-batch-jitter        |   195.4 |            88.5 |
| LineClamp | line-pretext-english-batch-jumps         |   106.2 |           122.6 |
| LineClamp | line-pretext-cjk-batch-continuous        |   164.6 |            94.6 |
| LineClamp | line-pretext-cjk-batch-jitter            |   230.7 |            99.1 |
| LineClamp | line-pretext-cjk-batch-jumps             |   118.8 |            64.5 |
| LineClamp | line-pretext-thai-batch-continuous       |   172.1 |            95.6 |
| LineClamp | line-pretext-thai-batch-jitter           |   185.4 |           104.5 |
| LineClamp | line-pretext-thai-batch-jumps            |   201.0 |            64.5 |
| LineClamp | line-pretext-long-token-batch-continuous |   471.8 |           109.5 |
| LineClamp | line-pretext-long-token-batch-jitter     |   460.0 |           110.7 |
| LineClamp | line-pretext-long-token-batch-jumps      |   179.1 |           116.4 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                     -43.7% |
| LineClamp | line-pretext-english-batch-jitter        |                     -54.7% |
| LineClamp | line-pretext-english-batch-jumps         |                     +15.4% |
| LineClamp | line-pretext-cjk-batch-continuous        |                    ~-42.5% |
| LineClamp | line-pretext-cjk-batch-jitter            |                    ~-57.0% |
| LineClamp | line-pretext-cjk-batch-jumps             |                     -45.7% |
| LineClamp | line-pretext-thai-batch-continuous       |                     -44.5% |
| LineClamp | line-pretext-thai-batch-jitter           |                    ~-43.6% |
| LineClamp | line-pretext-thai-batch-jumps            |                     -67.9% |
| LineClamp | line-pretext-long-token-batch-continuous |                     -76.8% |
| LineClamp | line-pretext-long-token-batch-jitter     |                    ~-75.9% |
| LineClamp | line-pretext-long-token-batch-jumps      |                     -35.0% |

## Correctness and comparability notes

The entrypoints are comparable only on the Pretext contract represented here: plain text, an explicit canvas font shorthand, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. The result does not generalize to the root entry's broader layout-authoritative API.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |      Active ms |    Active RME | Confidence                | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | -------------: | ------------: | ------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-long-token-batch-continuous |       -76.8% | 471.8 -> 109.5 |  3.6% -> 9.7% | normal                    |    -100.0% |               N/A |                     N/A |         -61.8% |          N/A |        N/A |         -0.5% |
| LineClamp | line-pretext-long-token-batch-jitter     |      ~-75.9% | 460.0 -> 110.7 | 2.9% -> 12.7% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -63.0% |          N/A |        N/A |         -0.5% |
| LineClamp | line-pretext-thai-batch-jumps            |       -67.9% |  201.0 -> 64.5 |  1.4% -> 4.1% | normal                    |    -100.0% |               N/A |                     N/A |         -37.4% |          N/A |        N/A |         +4.9% |
| LineClamp | line-pretext-cjk-batch-jitter            |      ~-57.0% |  230.7 -> 99.1 | 6.5% -> 22.1% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -25.2% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-jitter        |       -54.7% |  195.4 -> 88.5 | 3.7% -> 11.0% | normal                    |    -100.0% |               N/A |                     N/A |         -22.9% |          N/A |        N/A |         +0.2% |
| LineClamp | line-pretext-cjk-batch-jumps             |       -45.7% |  118.8 -> 64.5 |  4.4% -> 8.5% | normal                    |    -100.0% |               N/A |                     N/A |         -36.6% |          N/A |        N/A |         +5.0% |
| LineClamp | line-pretext-thai-batch-continuous       |       -44.5% |  172.1 -> 95.6 |  5.6% -> 9.2% | normal                    |    -100.0% |               N/A |                     N/A |          -7.8% |          N/A |        N/A |         +0.0% |
| LineClamp | line-pretext-english-batch-continuous    |       -43.7% |  172.2 -> 96.9 | 10.9% -> 5.4% | normal                    |    -100.0% |               N/A |                     N/A |         -27.2% |          N/A |        N/A |         +0.2% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                         |   Delta |     Value | Active delta | Active confidence         |
| --------- | ------------------------------------- | ------------------------------- | ------: | --------: | -----------: | ------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                      | -100.0% | 6080 -> 0 |       -43.7% | normal                    |
| LineClamp | line-pretext-english-batch-continuous | Character-data mutation records | -100.0% | 2016 -> 0 |       -43.7% | normal                    |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                      | -100.0% | 7360 -> 0 |       -54.7% | normal                    |
| LineClamp | line-pretext-english-batch-jitter     | Character-data mutation records | -100.0% | 2752 -> 0 |       -54.7% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                      | -100.0% | 4752 -> 0 |       +15.4% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | Character-data mutation records | -100.0% | 1792 -> 0 |       +15.4% | normal                    |
| LineClamp | line-pretext-cjk-batch-continuous     | BBox reads                      | -100.0% | 5232 -> 0 |      ~-42.5% | low (high active-time CV) |
| LineClamp | line-pretext-cjk-batch-continuous     | Character-data mutation records | -100.0% | 1200 -> 0 |      ~-42.5% | low (high active-time CV) |
| LineClamp | line-pretext-cjk-batch-jitter         | BBox reads                      | -100.0% | 7712 -> 0 |      ~-57.0% | low (high active-time CV) |
| LineClamp | line-pretext-cjk-batch-jitter         | Character-data mutation records | -100.0% | 3216 -> 0 |      ~-57.0% | low (high active-time CV) |
| LineClamp | line-pretext-cjk-batch-jumps          | BBox reads                      | -100.0% | 4688 -> 0 |       -45.7% | normal                    |
| LineClamp | line-pretext-cjk-batch-jumps          | Character-data mutation records | -100.0% | 1856 -> 0 |       -45.7% | normal                    |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
