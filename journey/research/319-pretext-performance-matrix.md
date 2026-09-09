# LineClamp entrypoint benchmark matrix

This report compares the root and opt-in Pretext LineClamp entries on their shared public contract. Settled resize workloads use `active ms`; real CSS transitions use ResizeObserver callback CPU and frame health because their wall duration is fixed by CSS. Structural counters show the browser work behind each result.

Generated from `/var/folders/cl/rgck0fr94vjb9t0xtr467ngw0000gn/T/vue-clamp-pretext-matrix-cGpM61`.

This slice measures mounted resize churn after both components have stabilized. Cold text/font preparation and consumer bundle size remain separate delivery signals in `318-pretext-integration-research.md`.

## Target summary

| Target          | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Resize callbacks | Mutation records | Offset reads | Style reads | Slot calls | Long tasks |
| --------------- | -------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | ------------------: | ---------------: | ---------------: | -----------: | ----------: | ---------: | ---------: |
| current         | on       |     23/23 |       5 |         8871.0 |           1009.1 |             6.9% |         28.8% |              8.6% |          35.8% |    4632.9 |    30101.9 |  25474.0 |     160969 |           80 |                 320 |            22272 |           131467 |            0 |       28800 |       7072 |          0 |
| current/pretext | on       |     23/23 |       5 |         8873.6 |            479.6 |            17.5% |         50.1% |             21.7% |          62.2% |    1990.0 |    29205.6 |  27211.5 |          0 |            0 |                   0 |            20560 |            59748 |            0 |           0 |       7072 |          0 |

## CSS transition runtime

Each row runs two real 240ms linear width transitions (460px -> 180px -> 460px) over 16 mounted clamps. CSS fixes wall duration, so callback CPU and frame health—not active or settled time—measure engine cost.

| Scenario                                          | Target          | Callback CPU | CPU / observed entry | Callback p95 | Callback max | Resize callbacks | Observed entries | Frame p95 | Dropped frames | BBox reads | Mutation records | Slot calls |
| ------------------------------------------------- | --------------- | -----------: | -------------------: | -----------: | -----------: | ---------------: | ---------------: | --------: | -------------: | ---------: | ---------------: | ---------: |
| line-pretext-english-batch-css-transition         | current         |      63.30ms |               68.2µs |       0.20ms |       0.40ms |              928 |              928 |   10.10ms |              0 |       4336 |             1890 |          0 |
| line-pretext-english-batch-css-transition         | current/pretext |       7.20ms |                7.8µs |       0.10ms |       0.20ms |              928 |              928 |   10.15ms |              0 |          0 |              258 |          0 |
| line-pretext-english-affixed-batch-css-transition | current         |      73.90ms |               79.6µs |       0.20ms |       0.50ms |              928 |              928 |    9.70ms |              0 |       6640 |             2146 |         64 |
| line-pretext-english-affixed-batch-css-transition | current/pretext |       6.10ms |                6.6µs |       0.10ms |       0.10ms |              928 |              928 |   10.00ms |              0 |          0 |              450 |         64 |

### Transition engine delta

| Scenario                                          | From    | To              | Callback CPU delta |      Callback CPU |     CPU / entry |          Frame p95 | Dropped frames | BBox delta | Mutation delta |
| ------------------------------------------------- | ------- | --------------- | -----------------: | ----------------: | --------------: | -----------------: | -------------: | ---------: | -------------: |
| line-pretext-english-batch-css-transition         | current | current/pretext |             -88.6% | 63.30ms -> 7.20ms | 68.2µs -> 7.8µs | 10.10ms -> 10.15ms |         0 -> 0 |    -100.0% |         -86.3% |
| line-pretext-english-affixed-batch-css-transition | current | current/pretext |             -91.7% | 73.90ms -> 6.10ms | 79.6µs -> 6.6µs |  9.70ms -> 10.00ms |         0 -> 0 |    -100.0% |         -79.0% |

## Width profile matrix

This describes the executed width input shape for each scenario. Width assignments count every write, including writes inside a burst; steps count the stable waits that are measured.

| Component | Scenario                                                 | Steps | Width assignments | Unique widths | Repeated assignments | Repeated transitions | Large deltas (>32px) | Max delta |
| --------- | -------------------------------------------------------- | ----: | ----------------: | ------------: | -------------------: | -------------------: | -------------------: | --------: |
| LineClamp | line-pretext-english-batch-continuous                    |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-english-batch-jitter                        |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-english-batch-jumps                         |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-english-dom-resize-batch-continuous         |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-english-dom-resize-batch-jitter             |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-english-dom-resize-batch-jumps              |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-cjk-batch-continuous                        |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-cjk-batch-jitter                            |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-cjk-batch-jumps                             |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-thai-batch-continuous                       |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-thai-batch-jitter                           |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-thai-batch-jumps                            |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-long-token-batch-continuous                 |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-long-token-batch-jitter                     |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-long-token-batch-jumps                      |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-english-affixed-batch-continuous            |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-english-affixed-batch-jitter                |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-english-affixed-batch-jumps                 |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-continuous |    70 |                71 |            36 |                   35 |                   35 |                    0 |         8 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jitter     |    70 |                71 |            53 |                   18 |                   18 |                    0 |        19 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jumps      |    27 |                28 |             7 |                   21 |                   21 |                   24 |       290 |
| LineClamp | line-pretext-english-batch-css-transition                |     2 |                 3 |             2 |                    1 |                    1 |                    2 |       280 |
| LineClamp | line-pretext-english-affixed-batch-css-transition        |     2 |                 3 |             2 |                    1 |                    1 |                    2 |       280 |

## Top low-noise active hotspots by target

Rows are sorted by median active time and limited to active RME <= 5.0%. Structural columns are `N/A` when counter tracking was disabled for that target.

### current

| Component | Scenario                                             | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ---------------------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jitter |     340.1 |       3.3% |       5 |       8128 |                   0 |             3126 |            0 |        4480 |
| LineClamp | line-pretext-thai-batch-jumps                        |     194.0 |       3.9% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jumps  |     193.5 |       2.6% |       5 |       6000 |                  64 |             3675 |            0 |        1728 |
| LineClamp | line-pretext-cjk-batch-continuous                    |      93.2 |       1.6% |       5 |       5232 |                   0 |             4912 |            0 |           0 |

### current/pretext

| Component | Scenario                              | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| --------- | ------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| LineClamp | line-pretext-english-batch-continuous |     186.9 |       4.1% |       5 |          0 |                   0 |             3872 |            0 |           0 |
| LineClamp | line-pretext-thai-batch-jitter        |      80.1 |       3.9% |       5 |          0 |                   0 |             3618 |            0 |           0 |

## Top low-noise active hotspots by component

Each component list keeps up to 5 rows with active RME <= 5.0%, sorted by median active time.

### current

#### LineClamp

| Scenario                                             | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ---------------------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-english-affixed-dom-resize-batch-jitter |     340.1 |       3.3% |       5 |       8128 |                   0 |             3126 |            0 |        4480 |
| line-pretext-thai-batch-jumps                        |     194.0 |       3.9% |       5 |       4688 |                   0 |             5136 |            0 |           0 |
| line-pretext-english-affixed-dom-resize-batch-jumps  |     193.5 |       2.6% |       5 |       6000 |                  64 |             3675 |            0 |        1728 |
| line-pretext-cjk-batch-continuous                    |      93.2 |       1.6% |       5 |       5232 |                   0 |             4912 |            0 |           0 |

### current/pretext

#### LineClamp

| Scenario                              | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |
| ------------------------------------- | --------: | ---------: | ------: | ---------: | ------------------: | ---------------: | -----------: | ----------: |
| line-pretext-english-batch-continuous |     186.9 |       4.1% |       5 |          0 |                   0 |             3872 |            0 |           0 |
| line-pretext-thai-batch-jitter        |      80.1 |       3.9% |       5 |          0 |                   0 |             3618 |            0 |           0 |

## Top structural hotspots by target

### current

| Component | Scenario                                                 | Counter                         | Value | Active ms | Active RME |
| --------- | -------------------------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-jitter                     | Mutation records                | 17792 |     427.3 |      10.0% |
| LineClamp | line-pretext-long-token-batch-continuous                 | Mutation records                | 17600 |     400.5 |      10.0% |
| LineClamp | line-pretext-long-token-batch-jitter                     | BBox reads                      | 15936 |     427.3 |      10.0% |
| LineClamp | line-pretext-long-token-batch-continuous                 | BBox reads                      | 15904 |     400.5 |      10.0% |
| LineClamp | line-pretext-long-token-batch-jitter                     | Character-data mutation records | 14432 |     427.3 |      10.0% |
| LineClamp | line-pretext-long-token-batch-continuous                 | Character-data mutation records | 14240 |     400.5 |      10.0% |
| LineClamp | line-pretext-english-affixed-batch-jitter                | BBox reads                      |  9248 |     250.0 |      11.1% |
| LineClamp | line-pretext-english-affixed-batch-continuous            | BBox reads                      |  8864 |     138.9 |      35.8% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jitter     | BBox reads                      |  8128 |     340.1 |       3.3% |
| LineClamp | line-pretext-cjk-batch-jitter                            | Mutation records                |  7744 |     286.6 |      12.0% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-continuous | BBox reads                      |  7744 |     288.3 |      16.3% |
| LineClamp | line-pretext-cjk-batch-jitter                            | BBox reads                      |  7712 |     286.6 |      12.0% |

### current/pretext

| Component | Scenario                                      | Counter                    | Value | Active ms | Active RME |
| --------- | --------------------------------------------- | -------------------------- | ----: | --------: | ---------: |
| LineClamp | line-pretext-long-token-batch-continuous      | Mutation records           |  5600 |      85.2 |      27.2% |
| LineClamp | line-pretext-long-token-batch-jitter          | Mutation records           |  5504 |     111.6 |      27.8% |
| LineClamp | line-pretext-cjk-batch-jitter                 | Mutation records           |  4816 |     182.7 |      16.8% |
| LineClamp | line-pretext-english-batch-jitter             | Mutation records           |  4576 |     181.4 |       6.5% |
| LineClamp | line-pretext-english-affixed-batch-jitter     | Mutation records           |  4272 |     184.7 |      11.4% |
| LineClamp | line-pretext-english-affixed-batch-continuous | Mutation records           |  4128 |      80.4 |      52.7% |
| LineClamp | line-pretext-english-batch-continuous         | Mutation records           |  3872 |     186.9 |       4.1% |
| LineClamp | line-pretext-cjk-batch-continuous             | Mutation records           |  3808 |      72.0 |      62.2% |
| LineClamp | line-pretext-thai-batch-continuous            | Mutation records           |  3680 |      79.9 |      57.5% |
| LineClamp | line-pretext-thai-batch-jitter                | Mutation records           |  3618 |      80.1 |       3.9% |
| LineClamp | line-pretext-english-affixed-batch-continuous | Attribute mutation records |  3424 |      80.4 |      52.7% |
| LineClamp | line-pretext-english-batch-continuous         | Attribute mutation records |  3360 |     186.9 |       4.1% |

## Top structural hotspots by component

Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.

### current

#### LineClamp

| Scenario                                 | Counter                         | Value | Active ms | Active RME |
| ---------------------------------------- | ------------------------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-jitter     | Mutation records                | 17792 |     427.3 |      10.0% |
| line-pretext-long-token-batch-continuous | Mutation records                | 17600 |     400.5 |      10.0% |
| line-pretext-long-token-batch-jitter     | BBox reads                      | 15936 |     427.3 |      10.0% |
| line-pretext-long-token-batch-continuous | BBox reads                      | 15904 |     400.5 |      10.0% |
| line-pretext-long-token-batch-jitter     | Character-data mutation records | 14432 |     427.3 |      10.0% |

### current/pretext

#### LineClamp

| Scenario                                  | Counter          | Value | Active ms | Active RME |
| ----------------------------------------- | ---------------- | ----: | --------: | ---------: |
| line-pretext-long-token-batch-continuous  | Mutation records |  5600 |      85.2 |      27.2% |
| line-pretext-long-token-batch-jitter      | Mutation records |  5504 |     111.6 |      27.8% |
| line-pretext-cjk-batch-jitter             | Mutation records |  4816 |     182.7 |      16.8% |
| line-pretext-english-batch-jitter         | Mutation records |  4576 |     181.4 |       6.5% |
| line-pretext-english-affixed-batch-jitter | Mutation records |  4272 |     184.7 |      11.4% |

## Entrypoint comparison summary

| From    | To              | Comparable scenarios | Low-conf active rows | Active delta |        Active ms | BBox delta | Client rect delta | Client rect entry delta | Resize callback delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |
| ------- | --------------- | -------------------: | -------------------: | -----------: | ---------------: | ---------: | ----------------: | ----------------------: | --------------------: | -------------: | -----------: | ----------: | ---------: | ------------: | --------------: |
| current | current/pretext |                21/23 |                16/21 |      ~-57.0% | 4632.9 -> 1990.0 |    -100.0% |           -100.0% |                 -100.0% |                 -8.4% |         -53.7% |          N/A |     -100.0% |       0.0% |         -3.0% |             N/A |

## Active time matrix

| Component | Scenario                                                 | current | current/pretext |
| --------- | -------------------------------------------------------- | ------: | --------------: |
| LineClamp | line-pretext-english-batch-continuous                    |   244.9 |           186.9 |
| LineClamp | line-pretext-english-batch-jitter                        |   266.3 |           181.4 |
| LineClamp | line-pretext-english-batch-jumps                         |   115.6 |            68.6 |
| LineClamp | line-pretext-english-dom-resize-batch-continuous         |   256.7 |           106.9 |
| LineClamp | line-pretext-english-dom-resize-batch-jitter             |   353.6 |            99.4 |
| LineClamp | line-pretext-english-dom-resize-batch-jumps              |   202.8 |            33.0 |
| LineClamp | line-pretext-cjk-batch-continuous                        |    93.2 |            72.0 |
| LineClamp | line-pretext-cjk-batch-jitter                            |   286.6 |           182.7 |
| LineClamp | line-pretext-cjk-batch-jumps                             |    98.5 |            31.8 |
| LineClamp | line-pretext-thai-batch-continuous                       |   103.1 |            79.9 |
| LineClamp | line-pretext-thai-batch-jitter                           |   103.3 |            80.1 |
| LineClamp | line-pretext-thai-batch-jumps                            |   194.0 |            55.7 |
| LineClamp | line-pretext-long-token-batch-continuous                 |   400.5 |            85.2 |
| LineClamp | line-pretext-long-token-batch-jitter                     |   427.3 |           111.6 |
| LineClamp | line-pretext-long-token-batch-jumps                      |   158.7 |            57.6 |
| LineClamp | line-pretext-english-affixed-batch-continuous            |   138.9 |            80.4 |
| LineClamp | line-pretext-english-affixed-batch-jitter                |   250.0 |           184.7 |
| LineClamp | line-pretext-english-affixed-batch-jumps                 |   117.0 |            62.6 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-continuous |   288.3 |            94.6 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jitter     |   340.1 |            93.8 |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jumps      |   193.5 |            41.1 |
| LineClamp | line-pretext-english-batch-css-transition                |     N/A |             N/A |
| LineClamp | line-pretext-english-affixed-batch-css-transition        |     N/A |             N/A |

## Entrypoint active delta matrix

| Component | Scenario                                                 | current -> current/pretext |
| --------- | -------------------------------------------------------- | -------------------------: |
| LineClamp | line-pretext-english-batch-continuous                    |                     -23.7% |
| LineClamp | line-pretext-english-batch-jitter                        |                     -31.9% |
| LineClamp | line-pretext-english-batch-jumps                         |                    ~-40.7% |
| LineClamp | line-pretext-english-dom-resize-batch-continuous         |                     -58.4% |
| LineClamp | line-pretext-english-dom-resize-batch-jitter             |                    ~-71.9% |
| LineClamp | line-pretext-english-dom-resize-batch-jumps              |                    ~-83.7% |
| LineClamp | line-pretext-cjk-batch-continuous                        |                    ~-22.7% |
| LineClamp | line-pretext-cjk-batch-jitter                            |                    ~-36.3% |
| LineClamp | line-pretext-cjk-batch-jumps                             |                    ~-67.7% |
| LineClamp | line-pretext-thai-batch-continuous                       |                    ~-22.5% |
| LineClamp | line-pretext-thai-batch-jitter                           |                     -22.5% |
| LineClamp | line-pretext-thai-batch-jumps                            |                    ~-71.3% |
| LineClamp | line-pretext-long-token-batch-continuous                 |                    ~-78.7% |
| LineClamp | line-pretext-long-token-batch-jitter                     |                    ~-73.9% |
| LineClamp | line-pretext-long-token-batch-jumps                      |                    ~-63.7% |
| LineClamp | line-pretext-english-affixed-batch-continuous            |                    ~-42.1% |
| LineClamp | line-pretext-english-affixed-batch-jitter                |                     -26.1% |
| LineClamp | line-pretext-english-affixed-batch-jumps                 |                    ~-46.5% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-continuous |                    ~-67.2% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jitter     |                    ~-72.4% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jumps      |                    ~-78.8% |
| LineClamp | line-pretext-english-batch-css-transition                |                        N/A |
| LineClamp | line-pretext-english-affixed-batch-css-transition        |                        N/A |

## Correctness and comparability notes

The comparison covers word-boundary prediction with controlled CSS typography, maxLines, end truncation, the default ellipsis, and before-and-after affixes. English rows include reactive component-width updates, settled direct outer-DOM resizes, and real CSS width transitions. Transition rows keep the LineClamp VNode unchanged and are compared by callback CPU and frame health. Custom ellipses, native cases, and measured fallback remain outside this matrix.

## Top movers by entrypoint

### current -> current/pretext

| Component | Scenario                                             | Active delta |      Active ms |     Active RME | Confidence                | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |
| --------- | ---------------------------------------------------- | -----------: | -------------: | -------------: | ------------------------- | ---------: | ----------------: | ----------------------: | -------------: | -----------: | ---------: | ------------: |
| LineClamp | line-pretext-english-dom-resize-batch-jumps          |      ~-83.7% |  202.8 -> 33.0 |  9.7% -> 45.9% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -89.0% |          N/A |        N/A |        -22.9% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jumps  |      ~-78.8% |  193.5 -> 41.1 |  2.6% -> 14.6% | low (high active-time CV) |    -100.0% |           -100.0% |                 -100.0% |         -57.5% |          N/A |       0.0% |        -22.9% |
| LineClamp | line-pretext-long-token-batch-continuous             |      ~-78.7% |  400.5 -> 85.2 | 10.0% -> 27.2% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -68.2% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-long-token-batch-jitter                 |      ~-73.9% | 427.3 -> 111.6 | 10.0% -> 27.8% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -69.1% |          N/A |        N/A |         -0.0% |
| LineClamp | line-pretext-english-affixed-dom-resize-batch-jitter |      ~-72.4% |  340.1 -> 93.8 |  3.3% -> 18.9% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -82.9% |          N/A |        N/A |         -7.9% |
| LineClamp | line-pretext-english-dom-resize-batch-jitter         |      ~-71.9% |  353.6 -> 99.4 |  5.3% -> 39.0% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -76.0% |          N/A |        N/A |         -9.2% |
| LineClamp | line-pretext-thai-batch-jumps                        |      ~-71.3% |  194.0 -> 55.7 |  3.9% -> 32.7% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -60.1% |          N/A |        N/A |         -0.2% |
| LineClamp | line-pretext-cjk-batch-jumps                         |      ~-67.7% |   98.5 -> 31.8 | 13.5% -> 52.4% | low (high active-time CV) |    -100.0% |               N/A |                     N/A |         -59.6% |          N/A |        N/A |         +0.1% |

## Top structural movers by entrypoint

### current -> current/pretext

| Component | Scenario                                         | Counter                     |   Delta |     Value | Active delta | Active confidence         |
| --------- | ------------------------------------------------ | --------------------------- | ------: | --------: | -----------: | ------------------------- |
| LineClamp | line-pretext-english-batch-continuous            | BBox reads                  | -100.0% | 6080 -> 0 |       -23.7% | normal                    |
| LineClamp | line-pretext-english-batch-continuous            | Child-list mutation records | -100.0% |   32 -> 0 |       -23.7% | normal                    |
| LineClamp | line-pretext-english-batch-continuous            | Added nodes                 | -100.0% |   16 -> 0 |       -23.7% | normal                    |
| LineClamp | line-pretext-english-batch-continuous            | Removed nodes               | -100.0% |   16 -> 0 |       -23.7% | normal                    |
| LineClamp | line-pretext-english-batch-jitter                | BBox reads                  | -100.0% | 7360 -> 0 |       -31.9% | normal                    |
| LineClamp | line-pretext-english-batch-jumps                 | BBox reads                  | -100.0% | 4752 -> 0 |      ~-40.7% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps                 | Child-list mutation records | -100.0% |  384 -> 0 |      ~-40.7% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps                 | Added nodes                 | -100.0% |  192 -> 0 |      ~-40.7% | low (high active-time CV) |
| LineClamp | line-pretext-english-batch-jumps                 | Removed nodes               | -100.0% |  192 -> 0 |      ~-40.7% | low (high active-time CV) |
| LineClamp | line-pretext-english-dom-resize-batch-continuous | BBox reads                  | -100.0% | 4960 -> 0 |       -58.4% | normal                    |
| LineClamp | line-pretext-english-dom-resize-batch-continuous | Child-list mutation records | -100.0% |   32 -> 0 |       -58.4% | normal                    |
| LineClamp | line-pretext-english-dom-resize-batch-continuous | Added nodes                 | -100.0% |   16 -> 0 |       -58.4% | normal                    |

## Visualization

The SVG contains two panels for settled resize workloads: absolute active time by entrypoint and the root-to-Pretext active-time delta. CSS transition rows are N/A because their fixed-duration comparison is reported separately above.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.

![LineClamp entrypoint benchmark matrix](319-pretext-performance-matrix.svg)
