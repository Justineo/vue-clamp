# Active update costs

## Retained changes

LineClamp commits the solved display state after a semantic prop change instead of first resetting
its reactive display state to the full source. The intermediate state previously scheduled another
Vue render even when the accessible-source structure stayed unchanged. Native rendering already
commits the source, so its stored text is synchronized without scheduling a structural update.
Search hints still invalidate, and transitions between full, clamped, empty, and native content
still update the DOM, accessible source, events, and state-dependent affixes.

RichLineClamp shares one preparation for adjacent identical HTML and boundary inputs. The retained
entry contains the inert parsed source and structural boundaries, bounded to 8,192 UTF-16 source
code units. Larger input evicts the entry. Each instance still owns its connected visible and probe
trees, CSS inspection, search state, and result. Pure `prepareRich` remains uncached; native and
inactive component modes still avoid preparation. This removes repeated parsing and segmentation
without treating identical HTML as proof of identical layout.

WrapClamp records the before-affix size while measuring the existing atomic sequence, then reuses
that size for shrink and materialized-grow verification. It still takes a new sequence measurement
after the Vue count commit; reuse never crosses a DOM mutation. Its private width-hint array also
updates in place instead of being copied for every measurement. Slot invalidation and final live
DOM verification remain unchanged.

## Where update work occurs

The source benchmark separates mounting, unrelated attribute updates, source updates, and captured
slot updates. For 48 instances and six updates, Line/Rich unrelated updates perform two geometry
reads per instance without affixes and three with an after-affix. They do not rerun the measured
search in the unchanged fixture. Wrap performs substantially more work because it must verify both
the current count and whether another arbitrary item now fits.

The removed Line display reset was a distinct source of redundant work:

| Same-width source update workload            | Baseline | Candidate |
| -------------------------------------------- | -------: | --------: |
| Measured Line: bounding-box reads            |    2,592 |     2,016 |
| Measured Line with after: bounding-box reads |    3,456 |     2,592 |
| Measured Line with after: slot calls         |      576 |       288 |

These are geometry reductions of 22.2% and 25.0%, not equivalent elapsed-time claims. The dedicated
source benchmark includes frame waits, so its settled durations are unsuitable for estimating CPU
savings. Identical Rich source updates reduce parses from 288 to six in the same 48-by-six setup.

A separate 91-row public Line/Rich comparison found no increase in geometry reads, style reads,
DOM mutations, affix-slot calls, or clone calls. Four Line source-update rows reduced geometry and
mutation counts; the remaining rows preserved those counters. This guards existing resize, font,
native, and complex-markup paths independently of the focused preparation timing experiment.

## Production comparison

An immutable built baseline and candidate ran in the same production Vue/Chromium process, with
target order alternating each round. Seven measured rounds followed a warmup round. Each workload
mounted 200 instances and performed six same-width updates of roughly 600-character multilingual
content. Timings cover each Vue update flush and exclude explicit frame waits. Visible body output
matched between targets after every update.

| Six-update Vue flush median    | Baseline | Candidate | Change |
| ------------------------------ | -------: | --------: | -----: |
| Line, distinct text            | 408.7 ms |  396.3 ms |  -3.0% |
| Line with after, distinct text | 425.2 ms |  408.8 ms |  -3.9% |
| Rich, identical HTML           | 914.3 ms |  870.4 ms |  -4.8% |
| Rich, distinct HTML            | 906.9 ms |  907.7 ms |  +0.1% |

Updates produced no additional ResizeObserver callback work in this fixture. Mount timings varied
even in controls that could not share preparation, so they do not establish a separate mounting
speedup. Rich's benefit is specific to repeated preparations; unrelated or unique HTML has no
claimed improvement.

## Wrap comparison

The 27 public Wrap scenarios used alternating built targets, a warmup, and two measured samples.
Six before-affix rows reduced bounding-box reads; the other 21 kept structural counters unchanged.

| Workload                  | Baseline reads | Candidate reads |
| ------------------------- | -------------: | --------------: |
| Before-affix grow         |         11,800 |          11,400 |
| Before-affix shrink       |         10,000 |           9,200 |
| Dynamic-before grow       |         16,700 |          16,300 |
| Dynamic-before shrink     |         13,200 |          12,400 |
| Before + maxHeight grow   |         18,000 |          17,600 |
| Before + maxHeight shrink |          7,400 |           6,600 |

Across all 27 rows, bounding-box reads fell from 318,408 to 314,808. Mutation counts stayed at
142,652. Summed active medians were 3,455.7 versus 3,456.1 ms: timing-neutral. This is a small removal
of duplicate browser work, not a demonstrated overall Wrap speedup.

## Rejected item-component experiment

Moving each Wrap item into its own Vue component reduced repeated slot execution: the no-affix
48-instance fixture fell from 8,928 to 3,168 calls across six unrelated updates. However, reactive
dependencies moved from the Wrap parent into the item children. A visible item-width shrink that
kept the outer line height unchanged no longer invalidated the parent; an existing browser contract
stayed at four items where six fit. The prototype also increased cold mounting cost.

The experiment was reverted. Restoring correctness would require explicit child-to-parent
invalidation and measuring the resulting component and scheduling overhead. Slot-call reductions
alone do not justify changing reactive ownership.

## Delivery cost

Production-minified isolated consumers with Vue external:

| Import        | Baseline gzip | Candidate gzip | Delta |
| ------------- | ------------: | -------------: | ----: |
| LineClamp     |       9,584 B |        9,580 B |  -4 B |
| RichLineClamp |      13,143 B |       13,215 B | +72 B |
| WrapClamp     |       5,434 B |        5,482 B | +48 B |

The remaining synchronous checks protect same-flush styling and slot changes. These experiments
identify specific removable work; they do not establish that any of the three components has
reached an absolute optimization limit.
