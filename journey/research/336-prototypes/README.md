# Research 336 prototypes

These experiments are not integrated. See [the decision and results](../336-rich-structure-batching-exploration.md).
The base commit is `d826aa59130bb154ac292defcd66f00f3efa6722`; `baseline.patch` adds the then-current
working source and tests (four-entry preparation pool, Wrap growth probing and warm plain Rich
batching, with the original ASCII fast path and no Han whitelist).

| Patch              | Apply to               | Purpose                                                                                          |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `baseline.patch`   | Base commit            | Reconstruct the current implementation used as the control                                       |
| `rejoin.patch`     | Reconstructed baseline | Serial structural barrier followed by shared text rounds                                         |
| `inspection.patch` | Reconstructed baseline | Shared full-tree restoration / inspection stage                                                  |
| `combined.patch`   | Reconstructed baseline | Both mechanisms; replaces the two individual patches                                             |
| `fixtures.patch`   | Base benchmark driver  | Real formatted/link/image/nested/selector-coupled workloads and optional immediate output checks |

Apply only in isolated checkouts. Run `vp install` in each, apply `baseline.patch`, apply one candidate
patch where appropriate, then build with `vp run vue-clamp#build`. Apply `fixtures.patch` in the driver
checkout. Keep the original workspace package names. The following variables denote built package
directories, each ending in `packages/vue-clamp`.

```sh
VUE_CLAMP_UPDATE_COUNTS=20 VUE_CLAMP_UPDATE_ROUNDS=8 VUE_CLAMP_UPDATE_STEPS=12 \
VUE_CLAMP_UPDATE_SCENARIOS=resize-rich-formatted-cross,resize-rich-links-cross-affix,font-rich-formatted-metrics,resize-rich-image-cross-height \
vp exec node tools/benchmark/scripts/measure-update-costs.mjs "$baseline" "$candidate"

RICH_IMMEDIATE=1 VUE_CLAMP_UPDATE_COUNTS=4 VUE_CLAMP_UPDATE_ROUNDS=1 VUE_CLAMP_UPDATE_STEPS=4 \
VUE_CLAMP_UPDATE_SCENARIOS=resize-rich-formatted-cross-affix,source-rich-links-alternating-affix,font-rich-formatted-metrics,resize-rich-image-cross-height,resize-rich-nested-cross,resize-rich-coupled-cross \
vp exec node tools/benchmark/scripts/measure-update-costs.mjs "$baseline" "$candidate"
```

Repeat the output screen for `VUE_CLAMP_UPDATE_BROWSER=firefox` and `webkit`; use
`VUE_CLAMP_UPDATE_BROWSER_PATH` if the installed browser executable differs from the default.
Run existing `mixed-batch`, `preparation`, `font-delivery` and `clamp` browser test files in the combined
candidate checkout with `vp test -c vite.browser.config.ts` and their full test paths.

The consumer-size driver in `../332-prototypes/measure-size.mjs` accepts an experiment directory and
package directory names. Production measurements used temporary source copies with declaration
emission disabled; this does not alter runtime compilation. Archived SHA-256 values hash sorted
JavaScript bundle names and contents using the comparison driver's algorithm. Formatting experimental
patches or changing the build toolchain can change these fingerprints.

`measurements.json` stores every retained timing round and its control, consumer sizes, output-screen
metadata and the targeted test result. Early small screening runs are superseded by the eight-round
confirmation; the corrected font fixture uses relative font sizes. A one-off instrumented CPU profile
is excluded from performance claims because profiler overhead changes the measured task cost.
