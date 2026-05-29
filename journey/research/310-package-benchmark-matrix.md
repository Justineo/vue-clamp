# Package benchmark matrix

This report compares the public component benchmark matrix across package versions. The primary timing signal is `active ms`; `settled ms` preserves the end-to-end quiet-frame timing, counters explain whether a change came from layout reads, DOM cloning/replacement, or slot rendering, and sample CV / RME report active timing variance.

Generated from `/tmp/vue-clamp-matrix-140-current-20260529-144101`.

## Version summary

| Version | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Offset reads | Item slot calls | Long tasks |
| ------- | --------: | ------: | -------------: | ---------------: | ---------------: | ------------: | ----------------: | -------------: | --------: | ---------: | -------: | ---------: | -----------: | -----------: | --------------: | ---------: |
| 1.4.0   |     56/56 |       4 |         2197.3 |           1017.1 |             3.4% |        111.2% |              3.9% |         276.4% |   14019.0 |    45300.1 |  31379.5 |     970191 |        82120 |       691172 |          989168 |         40 |
| 1.5.0   |     56/56 |       5 |         2121.3 |            816.3 |             3.9% |         37.8% |              5.0% |          60.1% |   10300.6 |    41389.8 |  31114.4 |     407471 |        82120 |       742940 |          297068 |         30 |
| 1.5.1   |     56/56 |       5 |         2105.8 |            856.1 |             3.7% |         79.0% |              4.8% |         152.0% |   10225.9 |    41402.7 |  31207.9 |     407439 |        82120 |       742556 |          297068 |         33 |
| current |     56/56 |       5 |         2115.0 |            693.4 |             4.2% |        102.5% |              4.8% |         232.4% |    7881.3 |    40789.6 |  32893.4 |     426952 |        54114 |            0 |          302068 |         29 |

## Adjacent release summary

| From  | To      | Comparable scenarios | Active delta |          Active ms | BBox delta | Client rect delta | Offset delta | Slot delta | Settled delta | Long task delta |
| ----- | ------- | -------------------: | -----------: | -----------------: | ---------: | ----------------: | -----------: | ---------: | ------------: | --------------: |
| 1.4.0 | 1.5.0   |                56/56 |       -26.5% | 14019.0 -> 10300.6 |     -58.0% |              0.0% |        +7.5% |     -70.0% |         -8.6% |          -24.1% |
| 1.5.0 | 1.5.1   |                56/56 |        -0.7% | 10300.6 -> 10225.9 |      -0.0% |              0.0% |        -0.1% |       0.0% |         +0.0% |           +8.3% |
| 1.5.1 | current |                56/56 |       -22.9% |  10225.9 -> 7881.3 |      +4.8% |            -34.1% |      -100.0% |      +1.7% |         -1.5% |          -10.8% |

## Active time matrix

| Component     | Scenario                              |  1.4.0 |  1.5.0 |  1.5.1 | current |
| ------------- | ------------------------------------- | -----: | -----: | -----: | ------: |
| LineClamp     | line-title-single-batch-sweep         |   28.5 |   37.4 |   31.5 |    28.9 |
| LineClamp     | line-title-single-affix-batch-sweep   |   40.6 |   40.8 |   39.1 |    34.3 |
| LineClamp     | line-summary-batch-continuous         |  155.0 |  150.2 |  132.4 |   124.4 |
| LineClamp     | line-prefixed-summary-batch-jumps     |   41.3 |   37.5 |   33.9 |    35.2 |
| LineClamp     | line-cta-affix-batch-continuous       |  542.3 |  603.4 |  593.9 |   352.4 |
| LineClamp     | line-cta-affix-batch-jitter           | 1224.4 | 1307.6 | 1017.6 |   682.9 |
| LineClamp     | line-cta-affix-batch-jumps            |  262.2 |  232.5 |  137.9 |   110.0 |
| LineClamp     | line-middle-log-batch-jumps           |  139.0 |  145.9 |  325.1 |   109.9 |
| LineClamp     | line-word-copy-batch-jumps            |  144.8 |  116.1 |  225.9 |   116.0 |
| LineClamp     | line-height-card-batch-jumps          |  187.4 |  174.7 |  158.2 |    99.9 |
| LineClamp     | line-custom-marker-batch-jumps        |  128.7 |  135.4 |  118.6 |    72.5 |
| InlineClamp   | inline-path-end-batch-continuous      |  266.3 |  275.0 |  309.3 |   246.5 |
| InlineClamp   | inline-path-end-batch-jumps           |   84.9 |   88.1 |   90.6 |    83.0 |
| InlineClamp   | inline-path-middle-batch-continuous   |  280.1 |  286.2 |  289.3 |   183.3 |
| InlineClamp   | inline-path-middle-batch-jitter       |  270.6 |  284.9 |  293.2 |   186.1 |
| InlineClamp   | inline-path-middle-batch-jumps        |  104.2 |  101.6 |   99.9 |    89.3 |
| InlineClamp   | inline-path-start-batch-jumps         |   96.3 |   97.6 |  102.4 |    87.1 |
| InlineClamp   | inline-split-file-path-batch-jumps    |   56.1 |   45.2 |   46.7 |    39.4 |
| InlineClamp   | inline-word-copy-batch-jumps          |   69.9 |   80.9 |   83.9 |    57.4 |
| InlineClamp   | inline-custom-marker-batch-jumps      |   85.9 |   87.5 |   86.9 |    79.8 |
| RichLineClamp | rich-article-fit-batch                |   18.0 |   18.9 |   18.0 |    13.0 |
| RichLineClamp | rich-metadata-affix-batch-continuous  |  561.4 |  573.7 |  571.7 |   379.3 |
| RichLineClamp | rich-metadata-affix-batch-jitter      |  654.1 |  716.1 |  707.6 |   507.5 |
| RichLineClamp | rich-metadata-affix-batch-jumps       |  108.4 |  118.4 |  115.1 |    99.7 |
| RichLineClamp | rich-inline-markup-batch-continuous   |  506.5 |  497.2 |  511.0 |   410.0 |
| RichLineClamp | rich-word-copy-batch-jumps            |   81.7 |   90.6 |   90.8 |    72.2 |
| RichLineClamp | rich-height-card-batch-jumps          |  104.8 |  104.3 |  106.2 |    88.4 |
| RichLineClamp | rich-custom-marker-batch-jumps        |   95.8 |   97.9 |   96.7 |    89.1 |
| RichLineClamp | rich-dense-batch-jumps                |   79.2 |   79.6 |   79.4 |    65.0 |
| WrapClamp     | wrap-single-line-width-sweep          |   31.0 |   30.3 |   38.5 |    31.1 |
| WrapClamp     | wrap-table-demo-width-sweep           |  271.6 |  274.9 |  273.7 |   269.2 |
| WrapClamp     | wrap-table-demo-width-churn           |  194.4 |  154.9 |  158.6 |   158.4 |
| WrapClamp     | wrap-no-affix-jump-grow               |  137.6 |   91.4 |   92.6 |    90.8 |
| WrapClamp     | wrap-no-affix-shrink                  |   90.0 |   59.7 |   60.9 |    61.5 |
| WrapClamp     | wrap-no-affix-hidden-grow             |  649.1 |  220.1 |  222.5 |   187.7 |
| WrapClamp     | wrap-no-affix-large-n                 |  121.5 |   54.0 |   54.1 |    44.6 |
| WrapClamp     | wrap-no-affix-narrow-item-grow        |  295.7 |  101.0 |  101.6 |    82.6 |
| WrapClamp     | wrap-no-affix-wide-item-grow          |  115.5 |   61.0 |   62.4 |    51.9 |
| WrapClamp     | wrap-no-affix-wide-container-grow     |  326.9 |  106.1 |  106.1 |    86.0 |
| WrapClamp     | wrap-no-affix-tiny-item-wide-grow     |  758.9 |  152.0 |  152.4 |   116.6 |
| WrapClamp     | wrap-no-affix-mixed-item-grow         |  193.6 |   88.6 |   87.3 |    86.9 |
| WrapClamp     | wrap-no-affix-heavy-item-grow         |  890.5 |  289.3 |  292.1 |   261.9 |
| WrapClamp     | wrap-before-affix-grow                |  443.4 |  194.2 |  196.2 |   132.5 |
| WrapClamp     | wrap-before-affix-shrink              |  141.0 |   76.8 |   79.0 |    76.1 |
| WrapClamp     | wrap-dynamic-before-grow              |  435.3 |  293.8 |  294.5 |   176.9 |
| WrapClamp     | wrap-dynamic-before-shrink            |  145.7 |  105.0 |  105.7 |   103.6 |
| WrapClamp     | wrap-static-after-grow                |  421.0 |  152.1 |  155.9 |   152.9 |
| WrapClamp     | wrap-static-after-shrink              |  185.1 |  188.1 |  186.5 |   183.9 |
| WrapClamp     | wrap-static-before-dynamic-after-grow |  514.9 |  196.9 |  197.2 |   193.9 |
| WrapClamp     | wrap-after-affix-shrink               |  209.9 |  212.7 |  212.8 |   212.8 |
| WrapClamp     | wrap-max-height-grow                  |  212.3 |  122.7 |  123.1 |   122.3 |
| WrapClamp     | wrap-max-height-shrink                |  127.9 |   64.3 |   65.0 |    64.2 |
| WrapClamp     | wrap-before-max-height-grow           |  227.5 |  136.9 |  142.8 |   145.1 |
| WrapClamp     | wrap-before-max-height-shrink         |  122.8 |   64.2 |   66.3 |    61.5 |
| WrapClamp     | wrap-mixed-lines-height-grow          |  210.8 |  121.9 |  120.2 |   121.0 |
| WrapClamp     | wrap-mixed-lines-height-shrink        |  126.9 |   62.4 |   65.0 |    62.9 |

## Adjacent active delta matrix

| Component     | Scenario                              | 1.4.0 -> 1.5.0 | 1.5.0 -> 1.5.1 | 1.5.1 -> current |
| ------------- | ------------------------------------- | -------------: | -------------: | ---------------: |
| LineClamp     | line-title-single-batch-sweep         |        ~+31.2% |        ~-15.8% |           ~-8.3% |
| LineClamp     | line-title-single-affix-batch-sweep   |          +0.5% |          -4.2% |          ~-12.3% |
| LineClamp     | line-summary-batch-continuous         |         ~-3.1% |        ~-11.9% |           ~-6.0% |
| LineClamp     | line-prefixed-summary-batch-jumps     |         ~-9.3% |         ~-9.3% |           ~+3.7% |
| LineClamp     | line-cta-affix-batch-continuous       |         +11.3% |         ~-1.6% |          ~-40.7% |
| LineClamp     | line-cta-affix-batch-jitter           |         ~+6.8% |        ~-22.2% |          ~-32.9% |
| LineClamp     | line-cta-affix-batch-jumps            |        ~-11.3% |        ~-40.7% |          ~-20.2% |
| LineClamp     | line-middle-log-batch-jumps           |         ~+5.0% |       ~+122.7% |          ~-66.2% |
| LineClamp     | line-word-copy-batch-jumps            |        ~-19.8% |        ~+94.5% |          ~-48.6% |
| LineClamp     | line-height-card-batch-jumps          |         ~-6.8% |         ~-9.4% |          ~-36.8% |
| LineClamp     | line-custom-marker-batch-jumps        |         ~+5.2% |        ~-12.5% |          ~-38.8% |
| InlineClamp   | inline-path-end-batch-continuous      |          +3.3% |        ~+12.5% |          ~-20.3% |
| InlineClamp   | inline-path-end-batch-jumps           |         ~+3.8% |         ~+2.8% |           ~-8.3% |
| InlineClamp   | inline-path-middle-batch-continuous   |         ~+2.2% |          +1.1% |           -36.6% |
| InlineClamp   | inline-path-middle-batch-jitter       |          +5.3% |         ~+2.9% |          ~-36.5% |
| InlineClamp   | inline-path-middle-batch-jumps        |          -2.4% |          -1.7% |           -10.7% |
| InlineClamp   | inline-path-start-batch-jumps         |          +1.3% |          +5.0% |           -14.9% |
| InlineClamp   | inline-split-file-path-batch-jumps    |        ~-19.4% |         ~+3.2% |          ~-15.4% |
| InlineClamp   | inline-word-copy-batch-jumps          |         +15.7% |          +3.7% |           -31.5% |
| InlineClamp   | inline-custom-marker-batch-jumps      |          +1.9% |         ~-0.6% |           ~-8.2% |
| RichLineClamp | rich-article-fit-batch                |          +5.0% |         ~-4.8% |          ~-27.8% |
| RichLineClamp | rich-metadata-affix-batch-continuous  |         ~+2.2% |         ~-0.3% |          ~-33.7% |
| RichLineClamp | rich-metadata-affix-batch-jitter      |          +9.5% |          -1.2% |           -28.3% |
| RichLineClamp | rich-metadata-affix-batch-jumps       |          +9.3% |          -2.8% |           -13.4% |
| RichLineClamp | rich-inline-markup-batch-continuous   |          -1.8% |          +2.8% |           -19.8% |
| RichLineClamp | rich-word-copy-batch-jumps            |         +10.8% |         ~+0.2% |          ~-20.5% |
| RichLineClamp | rich-height-card-batch-jumps          |          -0.4% |          +1.8% |           -16.7% |
| RichLineClamp | rich-custom-marker-batch-jumps        |         ~+2.2% |         ~-1.2% |            -7.8% |
| RichLineClamp | rich-dense-batch-jumps                |          +0.5% |          -0.3% |           -18.1% |
| WrapClamp     | wrap-single-line-width-sweep          |         ~-2.3% |        ~+27.1% |          ~-19.2% |
| WrapClamp     | wrap-table-demo-width-sweep           |          +1.2% |          -0.4% |            -1.6% |
| WrapClamp     | wrap-table-demo-width-churn           |         -20.3% |          +2.4% |            -0.1% |
| WrapClamp     | wrap-no-affix-jump-grow               |         -33.6% |          +1.3% |            -1.9% |
| WrapClamp     | wrap-no-affix-shrink                  |         -33.7% |          +2.0% |            +1.0% |
| WrapClamp     | wrap-no-affix-hidden-grow             |         -66.1% |          +1.1% |           -15.6% |
| WrapClamp     | wrap-no-affix-large-n                 |         -55.5% |          +0.1% |           -17.5% |
| WrapClamp     | wrap-no-affix-narrow-item-grow        |         -65.9% |          +0.6% |           -18.7% |
| WrapClamp     | wrap-no-affix-wide-item-grow          |         -47.2% |          +2.3% |           -16.8% |
| WrapClamp     | wrap-no-affix-wide-container-grow     |         -67.5% |          -0.0% |           -18.9% |
| WrapClamp     | wrap-no-affix-tiny-item-wide-grow     |         -80.0% |          +0.3% |           -23.5% |
| WrapClamp     | wrap-no-affix-mixed-item-grow         |         -54.3% |          -1.4% |            -0.5% |
| WrapClamp     | wrap-no-affix-heavy-item-grow         |         -67.5% |          +1.0% |           -10.3% |
| WrapClamp     | wrap-before-affix-grow                |         -56.2% |          +1.0% |           -32.5% |
| WrapClamp     | wrap-before-affix-shrink              |         -45.5% |          +2.9% |            -3.7% |
| WrapClamp     | wrap-dynamic-before-grow              |         -32.5% |          +0.2% |           -39.9% |
| WrapClamp     | wrap-dynamic-before-shrink            |         -27.9% |          +0.6% |            -1.9% |
| WrapClamp     | wrap-static-after-grow                |         -63.9% |          +2.5% |            -2.0% |
| WrapClamp     | wrap-static-after-shrink              |          +1.6% |          -0.8% |            -1.4% |
| WrapClamp     | wrap-static-before-dynamic-after-grow |         -61.8% |          +0.2% |            -1.7% |
| WrapClamp     | wrap-after-affix-shrink               |          +1.3% |          +0.0% |            -0.0% |
| WrapClamp     | wrap-max-height-grow                  |         -42.2% |          +0.3% |            -0.6% |
| WrapClamp     | wrap-max-height-shrink                |         -49.7% |          +1.2% |            -1.2% |
| WrapClamp     | wrap-before-max-height-grow           |         -39.8% |          +4.3% |            +1.6% |
| WrapClamp     | wrap-before-max-height-shrink         |         -47.7% |          +3.2% |            -7.2% |
| WrapClamp     | wrap-mixed-lines-height-grow          |         -42.2% |          -1.4% |            +0.7% |
| WrapClamp     | wrap-mixed-lines-height-shrink        |         -50.8% |          +4.1% |            -3.2% |

## Correctness and comparability notes

A faster older version is not automatically a performance win. When a release added missing reclamp coverage or fixed incorrect output, the extra work is correctness cost and the scenario should be interpreted with that caveat.

### 1.4.0 -> 1.5.0

- The benchmark matrix always uses WrapClamp's public item slot, matching the 1.5.0 contract; large WrapClamp changes should be interpreted together with rect-read and slot-call counters.

## Top movers by adjacent release

### 1.4.0 -> 1.5.0

| Component | Scenario                              | Active delta |      Active ms |   Active RME | Confidence | BBox delta | Client rect delta | Offset delta | Slot delta | Settled delta |
| --------- | ------------------------------------- | -----------: | -------------: | -----------: | ---------- | ---------: | ----------------: | -----------: | ---------: | ------------: |
| WrapClamp | wrap-no-affix-tiny-item-wide-grow     |       -80.0% | 758.9 -> 152.0 | 4.0% -> 1.3% | normal     |     -87.4% |               N/A |       +25.0% |     -92.5% |        -73.8% |
| WrapClamp | wrap-no-affix-wide-container-grow     |       -67.5% | 326.9 -> 106.1 | 1.1% -> 1.7% | normal     |     -74.1% |               N/A |       +25.0% |     -82.1% |        -57.4% |
| WrapClamp | wrap-no-affix-heavy-item-grow         |       -67.5% | 890.5 -> 289.3 | 3.3% -> 5.1% | normal     |     -67.5% |               N/A |       +25.0% |     -72.2% |        -60.5% |
| WrapClamp | wrap-no-affix-hidden-grow             |       -66.1% | 649.1 -> 220.1 | 3.2% -> 0.7% | normal     |     -67.5% |               N/A |       +25.0% |     -72.2% |        -57.2% |
| WrapClamp | wrap-no-affix-narrow-item-grow        |       -65.9% | 295.7 -> 101.0 | 2.4% -> 1.0% | normal     |     -71.5% |               N/A |       +25.0% |     -80.1% |        -53.5% |
| WrapClamp | wrap-static-after-grow                |       -63.9% | 421.0 -> 152.1 | 1.7% -> 1.2% | normal     |     -77.5% |               N/A |       +25.0% |     -68.0% |        -55.2% |
| WrapClamp | wrap-static-before-dynamic-after-grow |       -61.8% | 514.9 -> 196.9 | 2.6% -> 2.5% | normal     |     -71.8% |               N/A |       +25.0% |     -63.6% |        -55.1% |
| WrapClamp | wrap-before-affix-grow                |       -56.2% | 443.4 -> 194.2 | 3.2% -> 2.6% | normal     |     -43.4% |               N/A |       +25.0% |     -78.6% |        -50.0% |

### 1.5.0 -> 1.5.1

| Component   | Scenario                         | Active delta |        Active ms |      Active RME | Confidence                | BBox delta | Client rect delta | Offset delta | Slot delta | Settled delta |
| ----------- | -------------------------------- | -----------: | ---------------: | --------------: | ------------------------- | ---------: | ----------------: | -----------: | ---------: | ------------: |
| LineClamp   | line-middle-log-batch-jumps      |     ~+122.7% |   145.9 -> 325.1 | 24.9% -> 125.7% | low (high active-time CV) |       0.0% |              0.0% |         0.0% |        N/A |        +33.2% |
| LineClamp   | line-word-copy-batch-jumps       |      ~+94.5% |   116.1 -> 225.9 | 51.8% -> 152.0% | low (high active-time CV) |       0.0% |              0.0% |         0.0% |        N/A |        +20.6% |
| LineClamp   | line-cta-affix-batch-jumps       |      ~-40.7% |   232.5 -> 137.9 |  45.9% -> 15.4% | low (high active-time CV) |       0.0% |              0.0% |         0.0% |        N/A |         -5.3% |
| WrapClamp   | wrap-single-line-width-sweep     |      ~+27.1% |     30.3 -> 38.5 |  21.6% -> 13.0% | low (high active-time CV) |       0.0% |               N/A |         0.0% |       0.0% |         -0.0% |
| LineClamp   | line-cta-affix-batch-jitter      |      ~-22.2% | 1307.6 -> 1017.6 |  56.1% -> 16.6% | low (high active-time CV) |       0.0% |              0.0% |         0.0% |        N/A |         -6.2% |
| LineClamp   | line-title-single-batch-sweep    |      ~-15.8% |     37.4 -> 31.5 |  13.0% -> 34.3% | low (high active-time CV) |       0.0% |               N/A |         0.0% |        N/A |         -0.1% |
| LineClamp   | line-custom-marker-batch-jumps   |      ~-12.5% |   135.4 -> 118.6 |   29.9% -> 8.6% | low (high active-time CV) |       0.0% |              0.0% |         0.0% |        N/A |         -0.4% |
| InlineClamp | inline-path-end-batch-continuous |      ~+12.5% |   275.0 -> 309.3 |  19.0% -> 27.7% | low (high active-time CV) |       0.0% |               N/A |         0.0% |        N/A |         +0.1% |

### 1.5.1 -> current

| Component   | Scenario                            | Active delta |      Active ms |      Active RME | Confidence                | BBox delta | Client rect delta | Offset delta | Slot delta | Settled delta |
| ----------- | ----------------------------------- | -----------: | -------------: | --------------: | ------------------------- | ---------: | ----------------: | -----------: | ---------: | ------------: |
| LineClamp   | line-middle-log-batch-jumps         |      ~-66.2% | 325.1 -> 109.9 | 125.7% -> 36.8% | low (high active-time CV) |    +208.3% |            -25.0% |      -100.0% |        N/A |        -28.0% |
| LineClamp   | line-word-copy-batch-jumps          |      ~-48.6% | 225.9 -> 116.0 | 152.0% -> 82.7% | low (high active-time CV) |    +200.0% |            -28.6% |      -100.0% |        N/A |        -14.8% |
| LineClamp   | line-cta-affix-batch-continuous     |      ~-40.7% | 593.9 -> 352.4 |  27.0% -> 64.7% | low (high active-time CV) |    +196.9% |            -39.3% |      -100.0% |        N/A |         +1.5% |
| WrapClamp   | wrap-dynamic-before-grow            |       -39.9% | 294.5 -> 176.9 |    6.4% -> 1.9% | normal                    |     -58.8% |               N/A |      -100.0% |     -43.7% |        -34.9% |
| LineClamp   | line-custom-marker-batch-jumps      |      ~-38.8% |  118.6 -> 72.5 |  8.6% -> 163.1% | low (high active-time CV) |     +50.0% |            -42.0% |      -100.0% |        N/A |         -0.2% |
| LineClamp   | line-height-card-batch-jumps        |      ~-36.8% |  158.2 -> 99.9 |  68.9% -> 56.0% | low (high active-time CV) |     -60.5% |            -38.3% |      -100.0% |        N/A |         -1.0% |
| InlineClamp | inline-path-middle-batch-continuous |       -36.6% | 289.3 -> 183.3 |   4.6% -> 21.0% | normal                    |    +400.0% |               N/A |      -100.0% |        N/A |         -0.0% |
| InlineClamp | inline-path-middle-batch-jitter     |      ~-36.5% | 293.2 -> 186.1 | 65.5% -> 108.3% | low (high active-time CV) |    +400.0% |               N/A |      -100.0% |        N/A |         -0.0% |

## Visualization

The SVG contains two panels: absolute active time by version and adjacent active-time delta by release pair.

`~` marks a low-confidence delta: at least one side has active-time CV above 10%. SVG cells keep the normal direction color and add a top-right triangle marker.

![Package benchmark matrix](310-package-benchmark-matrix.svg)
