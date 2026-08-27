# Pretext integration research

## Decision

Do not add `@chenglou/pretext` to the `vue-clamp` production runtime at its current `0.0.8`
surface. Keep the prototype as an isolated benchmark dependency and research artifact.

The central reason is not that Pretext is ineffective. In a narrow, explicitly modeled text setup,
it predicts useful clamp ranks. For independent cold layouts, `vue-clamp` already converts its
unavoidable full-source browser measurement into an equally effective paid hint. During frequent
resizes, Pretext can reduce work for large discontinuous width jumps in a controlled word-boundary
subset, but forcing it into smooth or unsupported rows regresses them substantially. The useful
subset is therefore real but too narrow to justify almost another full library bundle and a second
layout model in the main runtime.

This is also the Polanyian boundary of the integration: browser layout contains tacit context that
is not present in the text and width alone—resolved font fallback, CSS inheritance and text
features, bidi shaping, affix geometry, nested inline boxes, and platform font behavior. Pretext
formalizes a valuable subset of that knowledge. It should become authoritative only where the
caller can prove that the subset is the whole environment.

## Questions tested

The prototype explored seven possible roles:

| Role                              | Result                                                                                                                                               | Decision                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `LineClamp` candidate-rank hint   | Strong versus a hint-free search; neutral on independent cold layouts; selectively useful for large resize jumps in modeled word rows                | Reject for the main runtime; preserve as adapter evidence |
| Replace `LineClamp` DOM authority | Predictions diverged under ordinary and unmodeled CSS cases                                                                                          | Reject                                                    |
| Full-text fit gate                | 168/169 supported sampled widths matched, but one false result is enough to make an unverified gate unsafe                                           | Reject as authority                                       |
| `InlineClamp` measured-mode hint  | Word-boundary case improved versus a hint-free search; custom ellipsis did not, and the real component already owns inline-specific measured history | No integration evidence                                   |
| `RichLineClamp` predictor         | One controlled flat-rich fixture matched 7/7 widths; the API intentionally does not model a nested DOM/CSS inline formatting tree                    | Reject for the general component                          |
| SSR/hydration layout answer       | Current runtime still requires Canvas 2D and `Intl.Segmenter`; upstream describes server-side support as future work                                 | Not currently applicable                                  |
| Separate opt-in adapter           | Technically possible for a closed design-system subset, but its size and correctness contract are too large for the demonstrated benefit             | Defer unless a separate product workload appears          |

`WrapClamp` was excluded because its unit of layout is an arbitrary rendered item box rather than a
text segment. Pretext does not observe those boxes.

## Prototype

The branch contains:

- a Pretext-to-`PreparedText` cursor/rank adapter for end truncation;
- first-line and last-line width reserves for fixed affixes;
- a research-only candidate-hint seam in the internal text layout function;
- Chromium comparisons against browser-authoritative final text;
- same-instance resize comparisons for continuous, bounded-jitter, and large-jump patterns, with
  retained warm hints and five counterbalanced timing repetitions;
- a narrow `rich-inline` comparison;
- a consumer-bundle size measurement for the exact imports used by each prototype.

No Pretext state, support mode, or prediction status is exposed to component users. The experiment
does not change the root package exports.

## Evidence

### Candidate search in isolation

Against a completely cold `clampTextToFit` search, exact word-boundary predictions reduced candidate
probes in several controlled rows:

| Scenario                           | Prediction exactness | Cold probes | Pretext-hinted probes | Change |
| ---------------------------------- | -------------------: | ----------: | --------------------: | -----: |
| English, named font, word boundary |                13/13 |          36 |                    14 |   -61% |
| CJK, named font, word boundary     |                13/13 |          19 |                     8 |   -58% |
| Thai, named font, word boundary    |                13/13 |          20 |                     7 |   -65% |
| Inline, named font, word boundary  |                11/11 |          53 |                    22 |   -58% |

This establishes that Pretext can be a useful rank predictor. It does not establish value in the
actual component path.

The broader Line sample had 106 exact predicted ranks across 169 supported widths. Examples that
lost accuracy or search efficiency included custom ellipsis, fixed affix reserves, `system-ui`,
automatic hyphenation, `text-transform`, `word-spacing`, emoji sequences, and word-to-grapheme
fallback for a long unbroken token. A repeated trailing-whitespace fixture could not be mapped back
to raw source offsets because Pretext normalizes the source stream.

### Complete cold `LineClamp` layout path

The decisive comparison starts from the current DOM path, including its full-source fit read and
paid line-count-ratio hint, then replaces the search hint with the Pretext prediction. Across 13
supported Line scenarios and 169 widths:

| Path                     | Authoritative `getClientRects()` reads |
| ------------------------ | -------------------------------------: |
| Current paid-signal path |                                    737 |
| Pretext-injected path    |                                    737 |

The structural count was identical in five repeated Chromium runs. Small elapsed-time differences
changed direction between runs and are treated as noise. All final rendered strings remained equal
because the browser still verified candidates.

This resolves the apparent opportunity from the isolated search: Pretext helps relative to no
hint, but the production path already owns an equally effective hint using information it has
already paid to obtain.

### Frequent container resize

The resize harness keeps one mounted DOM structure and the previous verified `TextClampResult`
across 560 width changes. It measures authoritative geometry reads (`getBoundingClientRect()` plus
`getClientRects()`), target text mutation records, and elapsed time. It retains the same calibrated
simple-line fit cache used by `LineClamp`; after the initial calibration, almost all repeated reads
in these rows are bounding-rect reads. Each timing is the median of five runs with current,
always-Pretext, and adaptive paths rotated to reduce run-order bias. The initial mount is excluded;
Pretext preparation is paid once after clearing its shared cache and measured separately at 0.1–0.6
ms in these fixtures.

Three patterns are covered:

- `continuous`: 1 px shrink/grow steps between 460 px and 180 px;
- `jitter`: deterministic local changes of at most 19 px;
- `jumps`: repeated 160–300 px discontinuities.

The harness deliberately executes one clamp pass per width value. A real `ResizeObserver` may
coalesce several changes in one frame, so this isolates the solver hot path and represents an upper
bound on how often an application can realize the saving; it does not measure Vue scheduling or
observer delivery.

Always replacing the verified warm hint with Pretext is the wrong integration. For example, the
English word row's continuous path changed from 737 to 978 geometry reads and from 570 to 852 mutation
records. Custom-ellipsis continuous resizing changed from 806 to 2,226 reads, while the unmodeled
uppercase row changed from 1,188 to 5,207. Prediction accuracy alone does not preserve search
locality.

The adaptive prototype therefore intervenes only when all of these are true:

- end truncation at a word boundary with more than one whole-word candidate;
- named font and only Pretext-modeled text features;
- no affixes;
- the width change and last measured rank imply movement beyond the current local warm-search
  coverage;
- the predicted boundary is nonzero and also lies outside that local coverage.

It preserves the current structural counts in continuous and jitter rows while improving the
large-jump cases:

| 560 changes              | Path               |         Geometry reads |              Mutations | Representative median time |
| ------------------------ | ------------------ | ---------------------: | ---------------------: | -------------------------: |
| English word, continuous | Current / adaptive |              737 / 737 |              570 / 570 |            neutral (~9 ms) |
| English word, jitter     | Current / adaptive |          1,545 / 1,545 |          1,218 / 1,218 |           neutral (~18 ms) |
| English word, jumps      | Current / adaptive | 1,937 / 1,070 (-44.8%) | 1,530 / 1,020 (-33.3%) |        ~20 / ~13 ms (-34%) |
| CJK word, continuous     | Current / adaptive |              473 / 473 |              248 / 248 |            neutral (~6 ms) |
| CJK word, jitter         | Current / adaptive |              863 / 863 |              632 / 632 |           neutral (~11 ms) |
| CJK word, jumps          | Current / adaptive | 1,784 / 1,223 (-31.4%) | 1,581 / 1,173 (-25.8%) |        ~21 / ~16 ms (-24%) |

All browser-verified final strings matched. Custom ellipsis, affix, long-token fallback, and
unmodeled uppercase rows stayed on the current path and therefore retained identical structural
counts. Their small elapsed-time differences changed direction across runs and are noise.

This changes the interpretation, but not the package decision: Pretext has a demonstrated use as a
far-jump rank oracle after ordinary warm evidence becomes stale. It is not a better general resize
engine.

### Rich inline

`@chenglou/pretext/rich-inline` matched browser line counts at 7/7 tested widths for one flat row
containing normal text, bold text, and an atomic padded chip. This validates the adapter idea only
for that constrained representation. `RichLineClamp` supports a trusted nested inline DOM tree,
whose inherited styles, vertical alignment, replaced elements, decorations, and box geometry are
outside the helper's intentionally flat `white-space: normal` model.

### Size

Vite production-minified consumer bundles for the exact prototype imports measured:

| Import surface          |      Raw |     Gzip |
| ----------------------- | -------: | -------: |
| Layout predictor        | 76,847 B | 17,796 B |
| `rich-inline` predictor | 81,599 B | 18,894 B |

For scale, the current production-minified consumer bundle containing all four `vue-clamp`
components is 19.250 kB gzip. The layout predictor alone is therefore about 92% of the current full
library bundle; `rich-inline` is about 98%. A main-entry integration is not proportionate to a
benefit confined to controlled word-boundary workloads with large discontinuous width changes.

## Integration paths worth preserving as options

These are not current `vue-clamp` roadmap items, but they define when the decision could change:

1. **A separate closed-world design-system adapter.** An application with named fonts, controlled
   CSS, end-only word truncation, no dynamic affixes, and a large responsive/virtualized list with
   discontinuous column changes could use Pretext as an application-level far-jump hint. The resize
   benchmark demonstrates this path. It should not alter the general component contract.
2. **A server-only pre-layout pipeline.** Revisit after Pretext can measure the same named font files
   in the deployment runtime and publishes a stable server API. The result would still need a
   hydration-safe browser correction contract.
3. **An upstream lightweight prediction surface.** A materially smaller entry that returns only
   line-break cursors could change the size equation, but it must still beat the paid browser signal
   in the complete path.
4. **A research/differential corpus tool.** Pretext can generate hypotheses for multilingual line
   breaks and help classify disagreement. It is not an independent browser oracle, so this is useful
   only when a concrete missing test class is identified.

## Revisit gates

Reopen production integration only when a held-out browser matrix demonstrates all of the following:

- at least 20% fewer authoritative layout reads in the complete component path, not only against a
  synthetic hint-free search;
- exact final output across the supported CSS/font/language contract, with browser verification
  retained for every unproved case;
- a delivery strategy that does not materially tax users who do not enter the accelerated subset;
- no new public state machine or diagnostic attributes required to operate the feature;
- a concrete workload where the improvement is visible at application scale.

## Sources

- Pretext package README and published `0.0.8` sources in the benchmark workspace
- <https://github.com/chenglou/pretext>
- Existing paid-signal design: `journey/research/314-paid-signal-cold-search.md`
- Current size attribution: `journey/research/315-final-architecture-sprint.md`
