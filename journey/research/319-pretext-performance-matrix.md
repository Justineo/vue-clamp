# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-sYBkEd`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8874.3 |            978.9 |             5.9% |         27.9% |              7.3% |          34.6% |    2735.7 |    16690.3 |  13979.0 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         8873.6 |            526.3 |            21.3% |         42.2% |             26.4% |          52.4% |    1234.5 |    16954.8 |  15719.0 |          0 |            0 |                   0 |              700 |            48118 |            0 |           0 |               0 |          0 |

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
| LineClamp | line-pretext-long-token-batch-continuous |     444.9 |       1.7% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jitter        |     275.8 |       3.5% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jumps            |     195.8 |       3.9% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |     166.3 |       4.6% |       5 |       6176 |                   0 |             6896 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jumps         |     120.3 |       3.9% |       5 |       4752 |                   0 |             5008 |            0 |           0 |

### current/pretext

| Component | Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-english-batch-jitter        |     153.6 |       2.4% |       5 |          0 |                   0 |             4560 |            0 |           0 |
| LineClamp | line-pretext-english-batch-jumps         |     131.5 |       4.2% |       5 |          0 |                   0 |             3216 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-continuous |     125.1 |       4.8% |       5 |          0 |                   0 |             5584 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |     113.3 |       2.3% |       5 |          0 |                   0 |             2144 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-continuous |     444.9 |       1.7% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| line-pretext-english-batch-jitter        |     275.8 |       3.5% |       5 |       7360 |                   0 |             6720 |            0 |           0 |
| line-pretext-thai-batch-jumps            |     195.8 |       3.9% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| line-pretext-long-token-batch-jumps      |     166.3 |       4.6% |       5 |       6176 |                   0 |             6896 |            0 |           0 |
| line-pretext-english-batch-jumps         |     120.3 |       3.9% |       5 |       4752 |                   0 |             5008 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-english-batch-jitter        |     153.6 |       2.4% |       5 |          0 |                   0 |             4560 |            0 |           0 |
| line-pretext-english-batch-jumps         |     131.5 |       4.2% |       5 |          0 |                   0 |             3216 |            0 |           0 |
| line-pretext-long-token-batch-continuous |     125.1 |       4.8% |       5 |          0 |                   0 |             5584 |            0 |           0 |
| line-pretext-long-token-batch-jumps      |     113.3 |       2.3% |       5 |          0 |                   0 |             2144 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     392.7 |       8.9% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     444.9 |       1.7% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     392.7 |       8.9% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     444.9 |       1.7% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     392.7 |       8.9% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     444.9 |       1.7% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     268.6 |      23.4% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     268.6 |      23.4% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     275.8 |       3.5% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     166.3 |       4.6% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     275.8 |       3.5% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     166.3 |       4.6% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  5584 |     125.1 |       4.8% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  5488 |      84.7 |      39.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  5152 |      75.7 |      40.8% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  4560 |     153.6 |       2.4% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  3968 |     106.2 |      43.3% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  3904 |     120.8 |      36.9% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3894 |     138.0 |      36.5% |
| LineClamp | line-pretext-thai-batch-continuous       | Mutation records           |  3776 |      57.9 |      52.4% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  3696 |      75.7 |      40.8% |
| LineClamp | line-pretext-thai-batch-jitter           | Attribute mutation records |  3636 |     138.0 |      36.5% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3456 |     106.2 |      43.3% |
| LineClamp | line-pretext-cjk-batch-continuous        | Attribute mutation records |  3456 |     120.8 |      36.9% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     392.7 |       8.9% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     444.9 |       1.7% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     392.7 |       8.9% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     444.9 |       1.7% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     392.7 |       8.9% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter          | Value | Active ms | Active RME |
| ---------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records |  5584 |     125.1 |       4.8% |
| line-pretext-long-token-batch-jitter     | Mutation records |  5488 |      84.7 |      39.6% |
| line-pretext-cjk-batch-jitter            | Mutation records |  5152 |      75.7 |      40.8% |
| line-pretext-english-batch-jitter        | Mutation records |  4560 |     153.6 |       2.4% |
| line-pretext-english-batch-continuous    | Mutation records |  3968 |     106.2 |      43.3% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |        Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | ---------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                 8/12 |      ~-54.9% | 2735.7 -> 1234.5 |    -100.0% |               N/A |                     N/A |                -93.5% |         -47.3% |          N/A |         N/A |        N/A |         +1.6% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   221.8 |           106.2 |
| LineClamp | line-pretext-english-batch-jitter        |   275.8 |           153.6 |
| LineClamp | line-pretext-english-batch-jumps         |   120.3 |           131.5 |
| LineClamp | line-pretext-cjk-batch-continuous        |   216.6 |           120.8 |
| LineClamp | line-pretext-cjk-batch-jitter            |   268.6 |            75.7 |
| LineClamp | line-pretext-cjk-batch-jumps             |    90.9 |            55.4 |
| LineClamp | line-pretext-thai-batch-continuous       |   144.9 |            57.9 |
| LineClamp | line-pretext-thai-batch-jitter           |   197.1 |           138.0 |
| LineClamp | line-pretext-thai-batch-jumps            |   195.8 |            72.3 |
| LineClamp | line-pretext-long-token-batch-continuous |   444.9 |           125.1 |
| LineClamp | line-pretext-long-token-batch-jitter     |   392.7 |            84.7 |
| LineClamp | line-pretext-long-token-batch-jumps      |   166.3 |           113.3 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                    ~-52.1% |
| LineClamp | line-pretext-english-batch-jitter        |                     -44.3% |
| LineClamp | line-pretext-english-batch-jumps         |                     ~+9.3% |
| LineClamp | line-pretext-cjk-batch-continuous        |                    ~-44.2% |
| LineClamp | line-pretext-cjk-batch-jitter            |                    ~-71.8% |
| LineClamp | line-pretext-cjk-batch-jumps             |                    ~-39.1% |
| LineClamp | line-pretext-thai-batch-continuous       |                    ~-60.0% |
| LineClamp | line-pretext-thai-batch-jitter           |                    ~-30.0% |
| LineClamp | line-pretext-thai-batch-jumps            |                     -63.1% |
| LineClamp | line-pretext-long-token-batch-continuous |                     -71.9% |
| LineClamp | line-pretext-long-token-batch-jitter     |                    ~-78.4% |
| LineClamp | line-pretext-long-token-batch-jumps      |                     -31.9% |

## Correctness and comparability notes

The entrypoints are comparable only on the Pretext contract represented here: plain text, an explicit canvas font shorthand, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. The result does not generalize to the root entry's broader layout-authoritative API.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |      Active ms |     Active RME | Confidence                                                  | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | -------------: | -------------: | ----------------------------------------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-long-token-batch-jitter     |      ~-78.4% |  392.7 -> 84.7 |  8.9% -> 39.6% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -69.2% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-long-token-batch-continuous |       -71.9% | 444.9 -> 125.1 |   1.7% -> 4.8% | normal                                                      |    -100.0% |               N/A |                     N/A |         -68.3% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-cjk-batch-jitter            |      ~-71.8% |  268.6 -> 75.7 | 23.4% -> 40.8% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -33.5% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-thai-batch-jumps            |       -63.1% |  195.8 -> 72.3 |   3.9% -> 6.5% | normal                                                      |    -100.0% |               N/A |                     N/A |         -37.4% |          N/A |        N/A |         +5.0% |
| LineClamp | line-pretext-thai-batch-continuous       |      ~-60.0% |  144.9 -> 57.9 | 20.4% -> 52.4% | low (high active-time CV; overlapping active-time mean MOE) |    -100.0% |               N/A |                     N/A |         -10.9% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-continuous    |      ~-52.1% | 221.8 -> 106.2 | 34.6% -> 43.3% | low (high active-time CV; overlapping active-time mean MOE) |    -100.0% |               N/A |                     N/A |         -31.1% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-batch-jitter        |       -44.3% | 275.8 -> 153.6 |   3.5% -> 2.4% | normal                                                      |    -100.0% |               N/A |                     N/A |         -32.1% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-cjk-batch-continuous        |      ~-44.2% | 216.6 -> 120.8 | 26.9% -> 36.9% | low (high active-time CV)                                   |    -100.0% |               N/A |                     N/A |         -20.5% |          N/A |        N/A |         -0.0% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                     |   Delta |     Value | Active delta | Active confidence                                           |
| --------- | ------------------------------------- | --------------------------- | ------: | --------: | -----------: | ----------------------------------------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                  | -100.0% | 6080 -> 0 |      ~-52.1% | low (high active-time CV; overlapping active-time mean MOE) |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                  | -100.0% | 7360 -> 0 |       -44.3% | normal                                                      |
| LineClamp | line-pretext-english-batch-jitter     | Child-list mutation records | -100.0% |  608 -> 0 |       -44.3% | normal                                                      |
| LineClamp | line-pretext-english-batch-jitter     | Added nodes                 | -100.0% |  608 -> 0 |       -44.3% | normal                                                      |
| LineClamp | line-pretext-english-batch-jitter     | Removed nodes               | -100.0% |  608 -> 0 |       -44.3% | normal                                                      |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                  | -100.0% | 4752 -> 0 |       ~+9.3% | low (overlapping active-time mean MOE)                      |
| LineClamp | line-pretext-cjk-batch-continuous     | BBox reads                  | -100.0% | 5232 -> 0 |      ~-44.2% | low (high active-time CV)                                   |
| LineClamp | line-pretext-cjk-batch-jitter         | BBox reads                  | -100.0% | 7712 -> 0 |      ~-71.8% | low (high active-time CV)                                   |
| LineClamp | line-pretext-cjk-batch-jumps          | BBox reads                  | -100.0% | 4688 -> 0 |      ~-39.1% | low (high active-time CV)                                   |
| LineClamp | line-pretext-thai-batch-continuous    | BBox reads                  | -100.0% | 4677 -> 0 |      ~-60.0% | low (high active-time CV; overlapping active-time mean MOE) |
| LineClamp | line-pretext-thai-batch-jitter        | BBox reads                  | -100.0% | 4852 -> 0 |      ~-30.0% | low (high active-time CV; overlapping active-time mean MOE) |
| LineClamp | line-pretext-thai-batch-jumps         | BBox reads                  | -100.0% | 4688 -> 0 |       -63.1% | normal                                                      |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
