# Research Report: Boundary-Oriented Rich Text Clipping for Multiline End Truncation

## Scope

This report focuses on the clipping and search algorithm for multiline end truncation of rich inline content. It assumes the following are already solved and reliable:

- overflow detection
- line box calculation
- browser layout measurement
- the ability to know whether a candidate clipped result fits

The goal is to replace a naive binary search over mixed structural units with a search space and clipping primitive that better match browser layout semantics.

This version intentionally does **not** optimize for word-aware truncation. Text refinement is based on grapheme-safe boundaries only. Word-aware preference can be added later without changing the core architecture.

---

## 1. Executive summary

- The current system keeps the right outer algorithm and the wrong inner search space. Binary search over prefixes is still the right shape, but the search should not run over mixed “kept units”.
- The best search space is a sequence of **legal cut positions** in content order, not a flattened list of text graphemes plus atom-like nodes.
- The best first-pass structure is a **two-level search**: search over logical inline run boundaries first, then refine inside only one text run using grapheme-safe boundaries.
- The best clipping primitive is **boundary-point slicing of the original tree**, conceptually equivalent to DOM Range slicing, not reconstruction from the flattened search representation.
- Transparent inline wrappers should preserve ancestry but should not become searchable units.
- Atomic inline content should be treated as indivisible boxes, with legal cuts only before or after them.
- Ellipsis must be inserted **before fit testing**, because it changes the available space on the last visible line.
- Line-aware or fragment-aware information is useful as an optimization layer, but it should not be the primary canonical search space.
- Compared with the current model, the proposed algorithm is more correct structurally, produces better clipping boundaries for rich content, and remains production-friendly in complexity.
- The single highest-leverage change is to replace “binary search over kept mixed units” with “binary search over ordered legal cut positions mapped back to boundary points in the original tree”.

---

## 2. Critique of the current approach

### Where the current approach works

The current algorithm works well in one important sense: it uses binary search over a monotone predicate. For end truncation, “keep more if it fits, keep less if it does not” is exactly the right outer control flow.

It also gets one important text decision mostly right: using grapheme-based text boundaries is far safer than searching over code points or code units. As a baseline, grapheme-safe cutting avoids many obviously broken text fragments.

For mostly plain text, or for rich content with very few inline elements, the current model is often good enough.

### Where it breaks down conceptually

The main issue is not binary search itself. The issue is the thing being searched.

The current system searches over a mixed list where:

- text contributes grapheme units
- atomic inline nodes contribute one unit each

That representation is too crude for rich inline content because it conflates several very different concepts:

- text segmentation
- inline box structure
- clipping output construction
- search indexing

These do not naturally belong in the same abstraction.

A transparent inline wrapper such as `span`, `em`, `strong`, or `a` is not a meaningful “length unit”. It is structural ancestry. Treating everything as a searchable unit either over-flattens wrappers away or forces them into awkward bookkeeping.

Likewise, an inline-block, image, inline SVG, or opaque embedded widget is not “one character”. It is an indivisible inline box. Modeling it as a unit-sized token is only a rough approximation.

### Where it produces poor clipping quality

The current model produces poor results in several cases:

- text split only by transparent wrappers can be treated as multiple separate units even though it should behave like one logical text flow
- atomic inline content is treated like a fake character instead of an indivisible box with meaningful before/after boundaries
- clipping quality depends too heavily on the flattening strategy rather than on real structural cut legality
- candidate generation tends to reconstruct output from the search representation, which increases the chance of malformed or semantically odd structure

In short, the current search space is not fundamentally unusable, but it is not the right conceptual model for rich inline clipping. It is not just slightly coarse. It is coarse in the wrong dimension.

---

## 3. Design options

### Option A. Grapheme or mixed-unit binary search

#### Core algorithm

Flatten text into grapheme units, represent atomic inline elements as one unit each, binary-search the number of kept units, rebuild a candidate, then test whether it fits.

#### Search space

A single global array of mixed units:

- grapheme units for text
- one unit per atomic inline node

#### Clipping primitive

Usually token-stream reconstruction or custom rebuild logic from the flattened representation.

#### Strengths

- simple to implement
- monotone and easy to reason about
- safe enough for many plain-text cases
- cheaper to prototype than more structural models

#### Weaknesses

- wrappers do not fit naturally into the model
- atomic inline content is treated too much like a fake character
- the search representation doubles as the rebuild format
- global grapheme search explores many positions that are not structurally meaningful

#### Visual-quality implications

Acceptable baseline quality for simple content, but the model becomes fragile once inline structure matters.

#### Conceptual complexity

Low.

#### Fit for rich inline end truncation

Useful as a baseline, but not a good final design.

---

### Option B. Word-first then grapheme refinement

#### Core algorithm

Binary-search word boundaries first, then refine inside the final word span using grapheme boundaries.

#### Search space

Two layers:

- coarse word-level boundaries
- fine grapheme boundaries

#### Clipping primitive

Can be paired with either token reconstruction or structural slicing.

#### Strengths

- often improves visible truncation quality for natural language text
- fewer search states than global grapheme search

#### Weaknesses

- word awareness is language-sensitive
- it does not solve the richer structural problems by itself
- it still needs a better node model and clipping primitive underneath

#### Visual-quality implications

Can improve text clipping quality, but mostly for word-oriented writing systems.

#### Conceptual complexity

Low to medium.

#### Fit for rich inline end truncation

Good as a future quality layer, but not the main answer for the current scope.

**Decision for this report:** defer it.

---

### Option C. Flattened token-boundary search

#### Core algorithm

Flatten the rich inline tree into a token sequence, create legal token boundaries, binary-search those boundaries, then reconstruct a clipped result from tokens.

#### Search space

Flattened token boundaries, not raw graphemes.

Tokens can include:

- text runs
- atomic inline placeholders
- explicit structure markers

#### Clipping primitive

Usually reconstruction from tokens back into a tree or subtree.

#### Strengths

- better than mixed grapheme-plus-atom units
- allows a cleaner coarse search than the current algorithm
- easier to add structural classes than in the current model

#### Weaknesses

- still fuses search representation with candidate construction
- reconstruction logic gets complicated
- still not as natural as slicing the original structure directly

#### Visual-quality implications

Better than the current approach, especially if text is grouped into logical runs, but still prone to reconstruction artifacts.

#### Conceptual complexity

Medium.

#### Fit for rich inline end truncation

A meaningful improvement, but not the best final architecture.

---

### Option D. DOM/tree boundary-point search

#### Core algorithm

Enumerate legal tree boundary points, binary-search those boundaries, and clip by slicing the original tree at the chosen boundary.

#### Search space

Boundary points in the original tree, ideally filtered into only legal cut positions.

#### Clipping primitive

Boundary-point slicing, conceptually like DOM Range slicing or `cloneContents()` behavior.

#### Strengths

- structurally precise
- naturally preserves ancestry
- partial boundary trimming is well defined
- search and output construction are cleanly separated

#### Weaknesses

- raw boundary points are too numerous and too noisy if used directly
- many raw DOM/text offsets are not good clipping boundaries
- needs a preprocessing layer to turn raw tree positions into meaningful legal cuts

#### Visual-quality implications

High potential quality when paired with good boundary filtering.

#### Conceptual complexity

Medium.

#### Fit for rich inline end truncation

Very good, but only if boundary points are filtered and organized properly.

---

### Option E. Fragment-aware or line-aware hybrid search

#### Core algorithm

Use line or fragment information to narrow the search region, then binary-search only within that region.

#### Search space

A subset of the content aligned to the last visible line or clamp neighborhood, with local boundaries inside it.

#### Clipping primitive

Usually still tree slicing or subtree reconstruction.

#### Strengths

- can reduce the number of probes
- aligns naturally with multiline truncation
- useful when line layout information is already available

#### Weaknesses

- rendered fragments are layout outputs, not the cleanest canonical search model
- can make the architecture more coupled to measurement details
- still needs a better structural representation underneath

#### Visual-quality implications

Good when used as a narrowing layer.

#### Conceptual complexity

High if used as the primary model, moderate if used only as an optimization.

#### Fit for rich inline end truncation

Useful as an optimization, not as the core abstraction.

---

## 4. Recommended algorithm

### 4.1 Recommendation in one sentence

Use a **boundary-oriented two-level search** over the original inline tree: search coarse **logical run boundaries** first, then refine only inside the active text run using **grapheme-safe boundaries**, and always materialize candidates by **boundary-point slicing of the original tree**.

### 4.2 Search representation

The search should operate on **legal cut positions**, not on kept mixed units.

A legal cut position is an endpoint in content order where the kept prefix may legally stop.

For the first implementation, use two levels:

1. **Run-end boundaries**
2. **Grapheme boundaries inside one text run**

The key idea is that the global search space should be small and structural, while the fine search should happen only where text actually needs to be split.

### 4.3 Logical inline run model

Preprocess the inline tree into **logical runs**.

A logical run is one of:

- **Text run**  
  A sequence of text that may cross transparent inline wrappers.  
  Example: `<em>hel</em><strong>lo</strong>` should contribute one logical text run, not two unrelated ones.

- **Atomic run**  
  An indivisible inline box such as:
  - replaced inline elements
  - inline-block
  - inline-table
  - inline SVG treated opaquely
  - unknown custom inline widgets treated conservatively

- **Structural wrapper only**  
  A transparent inline container that affects ancestry or styling but should not become a searchable unit.

This model is the main architectural difference from the current algorithm.

### 4.4 Why this representation is better

The current model asks one flattened list to do too much:

- represent text boundaries
- represent structure
- support search
- support rebuilding output

The recommended model separates those concerns:

- **search index** = ordered legal cut positions
- **source of truth for output** = original tree
- **text refinement unit** = grapheme boundary inside a logical text run
- **non-text structural behavior** = wrapper vs atomic

This separation is the main reason the new scheme is more reasonable.

### 4.5 Search refinement strategy

#### Stage 1: coarse search

Binary-search over the ends of logical runs.

This quickly finds the largest prefix that keeps whole runs intact.

#### Stage 2: fine search

If the next run is text, binary-search inside that single text run over its grapheme boundaries.

If the next run is atomic and does not fit, stop at the previous run boundary.

This gives most of the benefit of binary search while avoiding a global search over every grapheme in the whole document.

### 4.6 Candidate generation

Given a probe boundary, construct the candidate by **slicing the original tree** from the root start to the chosen end boundary.

Conceptually, candidate generation should behave like this:

- fully contained descendants stay intact
- partially contained ancestors are preserved shallowly
- only the final boundary text node is trimmed
- empty non-rendering wrappers can be pruned afterward

This is better than rebuilding from flattened search units because it preserves original structure by construction.

### 4.7 Clipping representation

Use **boundary-point slicing** as the clipping primitive.

That means every searchable cut position must map back to a precise location in the original tree:

- node
- offset

The output should not be reconstructed from the flattened run index. The run index exists only to guide search.

### 4.8 Text boundaries

For this version, text refinement is based only on **grapheme-safe boundaries**.

That means:

- never cut inside a grapheme cluster
- do not search raw code units
- do not treat text-node boundaries as meaningful if they are separated only by transparent wrappers

This keeps the first implementation conservative and structurally sound.

### 4.9 Non-text inline nodes

Use the following policy:

#### Transparent wrapper nodes

Examples:

- `span`
- `em`
- `strong`
- `a`
- other ordinary inline containers

Behavior:

- preserve in the output tree
- do not contribute searchable unit boundaries by themselves
- descendants participate in logical runs

#### Atomic inline nodes

Examples:

- replaced inline elements
- inline-block
- inline-table
- opaque SVG or widget content
- unknown custom inline content handled conservatively

Behavior:

- indivisible during search
- legal cut only before or after the node
- treated as one logical run, not as one fake grapheme

#### Special cases

- Empty inline wrappers that produce no visible content can be ignored or pruned.
- Ruby should usually be treated structurally, not as a generic one-unit atom.
- Unknown inline content should default to atomic if the system cannot safely reason about descendant participation.

### 4.10 Ellipsis insertion

Ellipsis should be inserted **during candidate generation before fit testing**.

Recommended flow:

1. choose a candidate end boundary
2. normalize backward over collapsible trailing whitespace
3. slice the prefix from the original tree
4. insert the ellipsis as a synthetic trailing inline token
5. measure whether that full candidate fits

This is better than adding ellipsis after the search because ellipsis changes the available space and final line fill.

### 4.11 Why this is better than the current unit model

The proposed scheme is better for four reasons:

1. **It uses the right abstraction for search**  
   Search is over legal cut positions, not over a flattened “how many things do we keep” list.

2. **It matches real inline structure better**  
   Transparent wrappers stay structural, atomic nodes stay indivisible, and text flows are treated logically.

3. **It makes candidate generation cleaner**  
   Output is sliced from the original tree instead of reconstructed from the search index.

4. **It keeps complexity under control**  
   The outer algorithm is still binary search. The main added complexity is a preprocessing pass that builds logical runs and maps fine text cuts back to tree boundaries.

---

## 5. Pseudocode

```text
DATA TYPES

BoundaryPoint:
  node
  offset

Run:
  kind: "text" | "atomic"
  startPoint: BoundaryPoint
  endPoint: BoundaryPoint
  graphemeCuts: BoundaryPoint[]   // text only

PREPROCESSING

function preprocess(root):
  runs = []
  currentTextRun = null

  walk(root)
  flushCurrentTextRun()

  return runs

function walk(node):
  if isTransparentWrapper(node):
    for child in children(node):
      walk(child)
    return

  if isAtomicInline(node):
    flushCurrentTextRun()
    runs.push(
      Run(
        kind = "atomic",
        startPoint = boundaryBefore(node),
        endPoint = boundaryAfter(node),
        graphemeCuts = []
      )
    )
    return

  if isTextNode(node):
    if currentTextRun == null:
      currentTextRun = startNewTextRun()
    appendTextSegment(currentTextRun, node)
    return

  for child in children(node):
    walk(child)

function flushCurrentTextRun():
  if currentTextRun == null:
    return

  currentTextRun.startPoint = firstBoundaryOfTextRun(currentTextRun)
  currentTextRun.endPoint = lastBoundaryOfTextRun(currentTextRun)
  currentTextRun.graphemeCuts =
    mapLogicalGraphemeOffsetsToBoundaryPoints(currentTextRun)

  runs.push(currentTextRun)
  currentTextRun = null


SEARCH

function findBestCut(root, runs, fits):
  coarseCuts = [run.endPoint for run in runs]

  coarseWinner = lastFitting(coarseCuts, root, fits)

  if coarseWinner is end of final run:
    return buildCandidate(root, coarseWinner, truncated = false)

  nextRun = runAfter(coarseWinner, runs)

  if nextRun.kind == "atomic":
    return buildCandidate(root, coarseWinner, truncated = true)

  fineCuts = nextRun.graphemeCuts
  fineWinner = lastFitting(
    fineCuts,
    root,
    fits,
    lowerBound = coarseWinner
  )

  if fineWinner exists:
    return buildCandidate(root, fineWinner, truncated = true)

  return buildCandidate(root, coarseWinner, truncated = true)

function lastFitting(cuts, root, fits, lowerBound = startOfRoot):
  lo = firstIndexAtOrAfter(lowerBound, cuts)
  hi = cuts.length - 1
  best = lowerBound

  while lo <= hi:
    mid = floor((lo + hi) / 2)
    probe = cuts[mid]
    candidate = buildCandidate(root, probe, truncated = true)

    if fits(candidate):
      best = probe
      lo = mid + 1
    else:
      hi = mid - 1

  return best


CANDIDATE GENERATION

function buildCandidate(root, endPoint, truncated):
  normalizedEnd = normalizeTrailingWhitespace(root, endPoint)
  prefix = slicePrefix(root, normalizedEnd)

  if truncated:
    insertEllipsis(prefix, normalizedEnd)

  return prefix

function slicePrefix(node, endPoint):
  if subtreeIsEntirelyAfter(node, endPoint):
    return null

  if subtreeIsEntirelyBefore(node, endPoint):
    return deepClone(node)

  if isTextNode(node):
    localEnd = offsetInsideTextNode(node, endPoint)
    return cloneText(node.data[0 : localEnd])

  clone = shallowClone(node)

  for child in children(node):
    part = slicePrefix(child, endPoint)
    if part != null:
      append(clone, part)

    if subtreeContains(endPoint, child):
      break

  return pruneEmptyNonRenderingWrapper(clone)

function insertEllipsis(prefixTree, endPoint):
  // insert a synthetic trailing inline token
  // default placement: deepest surviving text-capable container
```

---

## 6. Decision table

| Approach                        | Primary search space                                             | Candidate generation                        | Quality ceiling       | Complexity    | Verdict                                              |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- | --------------------- | ------------- | ---------------------------------------------------- |
| Current mixed units             | Global list of graphemes plus atom-like units                    | Rebuild from flattened units                | Low to medium         | Low           | Good baseline only                                   |
| Word-first then grapheme        | Word boundaries, then local grapheme refinement                  | Rebuild or slice                            | Medium to high        | Low to medium | Useful future refinement, not first priority         |
| Flattened token-boundary search | Token endpoints                                                  | Rebuild from tokens or subtree model        | Medium                | Medium        | Better than current, still not ideal                 |
| Raw tree boundary-point search  | All legal boundary points                                        | Boundary slicing                            | High if filtered well | Medium        | Strong primitive, search space still needs structure |
| Fragment-aware hybrid           | Last-line or fragment-local boundaries                           | Usually subtree slicing                     | High as optimization  | High          | Use only as optimization                             |
| **Recommended**                 | **Run boundaries first, then grapheme cuts inside one text run** | **Boundary-point slicing of original tree** | **High**              | **Medium**    | **Best overall tradeoff**                            |

---

## 7. If you only change one thing

**Keep binary search, but stop searching over mixed “kept units”. Search over ordered legal cut positions instead: whole logical run boundaries first, then grapheme-safe boundaries inside the one text run that actually needs to be split.**
