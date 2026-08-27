# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. The Pretext target receives the same numeric content width that styles each fixture, exercising its controlled `inlineSize` path. The primary timing signal is `active ms`; structural counters show the browser work behind each result, and sample CV / RME report active timing variance.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-7Zo6mb`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | --------------: | ---------: |
| current         | on       |     12/12 |       5 |         8874.1 |            896.9 |             6.6% |         14.4% |              8.2% |          17.8% |    2613.0 |    16689.0 |  14081.9 |      88057 |            0 |                   0 |            10688 |            91257 |            0 |           0 |               0 |          0 |
| current/pretext | on       |     12/12 |       5 |         5914.0 |            224.7 |            11.6% |         23.0% |             14.4% |          28.5% |     473.5 |    11122.5 |  10645.9 |          0 |            0 |                   0 |                0 |            45294 |            0 |           0 |               0 |          0 |

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
| LineClamp | line-pretext-long-token-batch-continuous |     417.9 |       3.5% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jitter     |     415.5 |       4.2% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| LineClamp | line-pretext-english-batch-continuous    |     221.0 |       2.5% |       5 |       6080 |                   0 |             5760 |            0 |           0 |
| LineClamp | line-pretext-long-token-batch-jumps      |     165.6 |       2.8% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

### current/pretext

| Component | Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-long-token-batch-continuous |      55.6 |       5.0% |       5 |          0 |                   0 |             5600 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-continuous |     417.9 |       3.5% |       5 |      15904 |                   0 |            17600 |            0 |           0 |
| line-pretext-long-token-batch-jitter     |     415.5 |       4.2% |       5 |      15936 |                   0 |            17792 |            0 |           0 |
| line-pretext-english-batch-continuous    |     221.0 |       2.5% |       5 |       6080 |                   0 |             5760 |            0 |           0 |
| line-pretext-long-token-batch-jumps      |     165.6 |       2.8% |       5 |       6176 |                   0 |             6896 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                                 | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-long-token-batch-continuous |      55.6 |       5.0% |       5 |          0 |                   0 |             5600 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                 | Counter                         | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     415.5 |       4.2% |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     417.9 |       3.5% |
| LineClamp | line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     415.5 |       4.2% |
| LineClamp | line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     417.9 |       3.5% |
| LineClamp | line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     415.5 |       4.2% |
| LineClamp | line-pretext-long-token-batch-continuous | Character-data mutation records | 13136 |     417.9 |       3.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records                |  7744 |     248.7 |       9.6% |
| LineClamp | line-pretext-cjk-batch-jitter            | BBox reads                      |  7712 |     248.7 |       9.6% |
| LineClamp | line-pretext-english-batch-jitter        | BBox reads                      |  7360 |     221.3 |       9.9% |
| LineClamp | line-pretext-long-token-batch-jumps      | Mutation records                |  6896 |     165.6 |       2.8% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records                |  6720 |     221.3 |       9.9% |
| LineClamp | line-pretext-long-token-batch-jumps      | BBox reads                      |  6176 |     165.6 |       2.8% |

### current/pretext

| Component | Scenario                                 | Counter                    | Value | Active ms | Active RME |
| --------- | ---------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous | Mutation records           |  5600 |      55.6 |       5.0% |
| LineClamp | line-pretext-long-token-batch-jitter     | Mutation records           |  5504 |      46.1 |      28.5% |
| LineClamp | line-pretext-cjk-batch-jitter            | Mutation records           |  4944 |      52.5 |       8.7% |
| LineClamp | line-pretext-english-batch-jitter        | Mutation records           |  4576 |      46.8 |      14.1% |
| LineClamp | line-pretext-english-batch-continuous    | Mutation records           |  3904 |      56.3 |       9.8% |
| LineClamp | line-pretext-cjk-batch-continuous        | Mutation records           |  3840 |      48.3 |      14.7% |
| LineClamp | line-pretext-thai-batch-continuous       | Mutation records           |  3712 |      40.1 |      24.4% |
| LineClamp | line-pretext-thai-batch-jitter           | Mutation records           |  3710 |      48.2 |      10.9% |
| LineClamp | line-pretext-cjk-batch-jitter            | Attribute mutation records |  3472 |      52.5 |       8.7% |
| LineClamp | line-pretext-thai-batch-jitter           | Attribute mutation records |  3452 |      48.2 |      10.9% |
| LineClamp | line-pretext-english-batch-continuous    | Attribute mutation records |  3392 |      56.3 |       9.8% |
| LineClamp | line-pretext-cjk-batch-continuous        | Attribute mutation records |  3392 |      48.3 |      14.7% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     415.5 |       4.2% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     417.9 |       3.5% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     415.5 |       4.2% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     417.9 |       3.5% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 13376 |     415.5 |       4.2% |

### current/pretext

#### LineClamp

| Scenario                                 | Counter          | Value | Active ms | Active RME |
| ---------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous | Mutation records |  5600 |      55.6 |       5.0% |
| line-pretext-long-token-batch-jitter     | Mutation records |  5504 |      46.1 |      28.5% |
| line-pretext-cjk-batch-jitter            | Mutation records |  4944 |      52.5 |       8.7% |
| line-pretext-english-batch-jitter        | Mutation records |  4576 |      46.8 |      14.1% |
| line-pretext-english-batch-continuous    | Mutation records |  3904 |      56.3 |       9.8% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |       Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | --------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                12/12 |                 7/12 |      ~-81.9% | 2613.0 -> 473.5 |    -100.0% |               N/A |                     N/A |               -100.0% |         -50.4% |          N/A |         N/A |        N/A |        -33.4% |             N/A |

## Active time matrix

| Component | Scenario                                 | current | current/pretext |
| --------- | ---------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous    |   221.0 |            56.3 |
| LineClamp | line-pretext-english-batch-jitter        |   221.3 |            46.8 |
| LineClamp | line-pretext-english-batch-jumps         |   107.2 |            24.6 |
| LineClamp | line-pretext-cjk-batch-continuous        |   173.8 |            48.3 |
| LineClamp | line-pretext-cjk-batch-jitter            |   248.7 |            52.5 |
| LineClamp | line-pretext-cjk-batch-jumps             |   109.7 |            24.3 |
| LineClamp | line-pretext-thai-batch-continuous       |   162.7 |            40.1 |
| LineClamp | line-pretext-thai-batch-jitter           |   186.2 |            48.2 |
| LineClamp | line-pretext-thai-batch-jumps            |   183.4 |            12.4 |
| LineClamp | line-pretext-long-token-batch-continuous |   417.9 |            55.6 |
| LineClamp | line-pretext-long-token-batch-jitter     |   415.5 |            46.1 |
| LineClamp | line-pretext-long-token-batch-jumps      |   165.6 |            18.3 |

## Entrypoint active delta matrix

| Component | Scenario                                 | current -> current/pretext |
| --------- | ---------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous    |                     -74.5% |
| LineClamp | line-pretext-english-batch-jitter        |                    ~-78.9% |
| LineClamp | line-pretext-english-batch-jumps         |                     -77.1% |
| LineClamp | line-pretext-cjk-batch-continuous        |                    ~-72.2% |
| LineClamp | line-pretext-cjk-batch-jitter            |                     -78.9% |
| LineClamp | line-pretext-cjk-batch-jumps             |                    ~-77.8% |
| LineClamp | line-pretext-thai-batch-continuous       |                    ~-75.4% |
| LineClamp | line-pretext-thai-batch-jitter           |                     -74.1% |
| LineClamp | line-pretext-thai-batch-jumps            |                    ~-93.2% |
| LineClamp | line-pretext-long-token-batch-continuous |                     -86.7% |
| LineClamp | line-pretext-long-token-batch-jitter     |                    ~-88.9% |
| LineClamp | line-pretext-long-token-batch-jumps      |                    ~-88.9% |

## Correctness and comparability notes

The entrypoints are comparable only on the Pretext contract represented here: plain text, an explicit canvas font shorthand, an exact numeric content width, maxLines, end truncation, word boundaries with grapheme fallback, and the default ellipsis. The result does not generalize to the root entry's broader layout-authoritative API or Pretext's observer fallback.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                 | Active delta |     Active ms |    Active RME | Confidence                | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------- | -----------: | ------------: | ------------: | ------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-thai-batch-jumps            |      ~-93.2% | 183.4 -> 12.4 | 6.7% -> 21.5% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -52.3% |          N/A |        N/A |        -33.4% |
| LineClamp | line-pretext-long-token-batch-jumps      |      ~-88.9% | 165.6 -> 18.3 | 2.8% -> 19.9% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -68.7% |          N/A |        N/A |        -33.6% |
| LineClamp | line-pretext-long-token-batch-jitter     |      ~-88.9% | 415.5 -> 46.1 | 4.2% -> 28.5% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -69.1% |          N/A |        N/A |        -33.4% |
| LineClamp | line-pretext-long-token-batch-continuous |       -86.7% | 417.9 -> 55.6 |  3.5% -> 5.0% | normal                    |    -100.0% |               N/A |                     N/A |         -68.2% |          N/A |        N/A |        -33.3% |
| LineClamp | line-pretext-cjk-batch-jitter            |       -78.9% | 248.7 -> 52.5 |  9.6% -> 8.7% | normal                    |    -100.0% |               N/A |                     N/A |         -36.2% |          N/A |        N/A |        -33.3% |
| LineClamp | line-pretext-english-batch-jitter        |      ~-78.9% | 221.3 -> 46.8 | 9.9% -> 14.1% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -31.9% |          N/A |        N/A |        -33.4% |
| LineClamp | line-pretext-cjk-batch-jumps             |      ~-77.8% | 109.7 -> 24.3 | 9.8% -> 25.9% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -51.7% |          N/A |        N/A |        -33.5% |
| LineClamp | line-pretext-english-batch-jumps         |       -77.1% | 107.2 -> 24.6 |  6.7% -> 9.6% | normal                    |    -100.0% |               N/A |                     N/A |         -51.1% |          N/A |        N/A |        -33.4% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                              | Counter                     |   Delta |     Value | Active delta | Active confidence         |
| --------- | ------------------------------------- | --------------------------- | ------: | --------: | -----------: | ------------------------- |
| LineClamp | line-pretext-english-batch-continuous | BBox reads                  | -100.0% | 6080 -> 0 |       -74.5% | normal                    |
| LineClamp | line-pretext-english-batch-continuous | ResizeObserver callbacks    | -100.0% | 1120 -> 0 |       -74.5% | normal                    |
| LineClamp | line-pretext-english-batch-jitter     | BBox reads                  | -100.0% | 7360 -> 0 |      ~-78.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Child-list mutation records | -100.0% |  608 -> 0 |      ~-78.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Added nodes                 | -100.0% |  608 -> 0 |      ~-78.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | Removed nodes               | -100.0% |  608 -> 0 |      ~-78.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jitter     | ResizeObserver callbacks    | -100.0% | 1120 -> 0 |      ~-78.9% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps      | BBox reads                  | -100.0% | 4752 -> 0 |       -77.1% | normal                    |
| LineClamp | line-pretext-english-batch-jumps      | ResizeObserver callbacks    | -100.0% |  432 -> 0 |       -77.1% | normal                    |
| LineClamp | line-pretext-cjk-batch-continuous     | BBox reads                  | -100.0% | 5232 -> 0 |      ~-72.2% | low (high active-time CV) |
| LineClamp | line-pretext-cjk-batch-continuous     | ResizeObserver callbacks    | -100.0% | 1120 -> 0 |      ~-72.2% | low (high active-time CV) |
| LineClamp | line-pretext-cjk-batch-jitter         | BBox reads                  | -100.0% | 7712 -> 0 |       -78.9% | normal                    |

## Visualization

The SVG contains two panels: absolute active time by entrypoint and the root-to-Pretext active-time delta.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
