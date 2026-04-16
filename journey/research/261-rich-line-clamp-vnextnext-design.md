# RichLineClamp vNext Implementation Report

## Summary

This report defines a **lightweight redesign** of `RichLineClamp` for the next implementation.

The key direction is:

- Keep the public API as `html: string`
- Keep the shared binary-search flow aligned with the existing pure text clamp
- Stop using `innerHTML` as the steady-state update model
- Use a **persistent hidden probe tree** for measurement
- Use **in-place candidate updates** during binary search
- Use a **prefix-preserving tail replacement** strategy for both probe updates and visible commits
- Avoid a full DOM diff engine or any editor-like patch system

This is intentionally **not** a full structural rendering architecture. It is a focused fix for the current problem.

---

## Problem Statement

The current rich clamp pipeline recreates DOM too aggressively.

Today, rich candidate application is effectively based on serialized HTML and subtree replacement. That causes several issues:

- repeated DOM churn during binary search
- repeated creation of `<img>` elements
- possible repeated fetch/decode work for remote images
- unstable node identity
- unnecessary parse / GC / style work
- visible flicker under some conditions

The deeper issue is not the removed `visibility: hidden` behavior. The real issue is that a width-only reclamp is currently treated as an HTML regeneration problem instead of a boundary-update problem.

For this component, the real hot-path state is:

> same source HTML, different cut point

So the internal steady-state model should be based on **cut points**, not regenerated HTML strings.

---

## Design Goals

1. **Preserve the public API**
   - input remains `html: string`

2. **Stay aligned with pure text clamp**
   - share the same boundary-search flow
   - reuse common binary-search logic where possible

3. **Avoid repeated subtree replacement**
   - no repeated `innerHTML` during binary search
   - no `innerHTML` for width-only visible commits

4. **Keep the design simple**
   - no full virtual DOM
   - no general diff engine
   - no character-level incremental text editing
   - no media-specific runtime architecture

5. **Target presentation-only rich content**
   - not interactive widgets
   - not long-lived DOM-attached behavior
   - not rich editor semantics

---

## Non-Goals

This version does **not** attempt to provide:

- minimal possible DOM edits in every case
- identity preservation inside the changed tail
- state preservation for media, canvas, iframe, custom elements, or DOM-attached listeners in the changed tail
- a general-purpose rich HTML patch engine
- image placeholder substitution as a core architecture
- special handling for every complex HTML feature

This is a display-oriented clamp component, not a rich interaction container.

---

## Core Design Decision

## 1. Internal Result Type

The clamp result must no longer be “final HTML string”.

Instead, the result should be a structural decision:

```ts
interface ClampDecision {
  kind: "full" | "clamped" | "fallback";
  boundaryIndex?: number;
  fallback?: string;
}
```

Meaning:

- `full`: full content fits
- `clamped`: content is cut at `boundaryIndex`
- `fallback`: rich rendering cannot be used, use plain fallback text

This keeps the search space aligned with the pure text clamp: the search still operates over an ordered boundary space.

---

## 2. Shared Search Flow with Pure Text Clamp

The reusable shared flow should remain:

1. prepare boundary space
2. given a candidate boundary, apply candidate
3. measure whether it fits
4. binary search for the last fitting boundary
5. commit final result

The important point is:

- **shared layer owns search**
- **rich layer owns candidate materialization**

So rich clamp should provide a small set of hooks like:

- `prepareRichSource(html)`
- `probe.patchTo(boundaryIndex)`
- `probe.measureFits()`
- `visible.patchTo(boundaryIndex)`

This keeps the rich implementation aligned with the pure text clamp without forcing a shared rendering abstraction.

---

## 3. Persistent Hidden Probe

Binary search should run on a **persistent hidden probe DOM tree**.

Requirements:

- connected to the document
- hidden from the user
- layout-participating
- same component styling context as the visible content

Recommended characteristics:

- `visibility: hidden`
- `pointer-events: none`
- `position: absolute`
- same width constraints as visible content
- `aria-hidden="true"`

Important: this is **not** a detached probe. It must stay connected so layout measurement remains faithful.

---

## 4. In-Place Binary Search

Yes, in-place binary search is supported and recommended.

But “in-place” should mean:

> reuse the same persistent probe tree across candidate changes, and patch only the changed tail between the current candidate and the next candidate

It should **not** mean:

- edit the visible DOM during search
- perform ultra-fine-grained minimal DOM surgery
- do full subtree replacement per candidate

So the search loop becomes:

```ts
while (lo <= hi) {
  const mid = ...
  probe.patchTo(mid)

  if (probe.fits()) {
    best = mid
    lo = mid + 1
  } else {
    hi = mid - 1
  }
}
```

The binary-search algorithm itself does not need to change. Only candidate application changes.

---

## High-Level Architecture

The component maintains three representations:

### 1. Template Source

A stable prepared representation of the original rich HTML.

### 2. Probe Tree

A persistent hidden DOM tree used during binary search.

### 3. Visible Tree

The actual rendered rich content.

Lifecycle:

- source change:
  - prepare template
  - initialize probe tree
  - initialize visible tree
- width change:
  - binary-search on probe using in-place updates
  - commit final boundary to visible tree using the same patch model

---

## Data Model

## 1. Boundary Representation

Use the existing path-based boundary model.

```ts
type NodePath = number[];

type BoundaryPoint =
  | {
      kind: "text";
      path: NodePath;
      offset: number;
    }
  | {
      kind: "element";
      path: NodePath;
      childIndex: number;
    };
```

This should stay compatible with the existing rich prepare layer.

---

## 2. Prepared Rich Source

```ts
interface PreparedRichSource {
  templateRoot: DocumentFragment;
  boundaries: BoundaryPoint[];
  fallbackText: string;
}
```

This is intentionally small.

Optional metadata may be added later if needed, but should not be part of the first implementation unless clearly useful.

---

## 3. Patch Anchor

The patch algorithm should not patch directly from an arbitrary exact `BoundaryPoint`.

Instead, it should patch from a normalized ancestor boundary:

```ts
interface PatchAnchor {
  ancestorPath: NodePath;
  startChildIndex: number;
}
```

Meaning:

- `ancestorPath` points to an element node
- `startChildIndex` marks the first child from which the suffix will be rebuilt

---

## Patch Model

## Principle

Do **not** implement a general structural patch engine.

Instead, use a constrained strategy:

> preserve a stable shared prefix, delete the suffix, rebuild the suffix from the template

This gives a very good complexity/performance tradeoff.

---

## Patch Scope

For a transition from `currentBoundary` to `targetBoundary`:

1. find a safe patch anchor
2. keep everything before the anchor
3. delete everything after the anchor
4. rebuild only the new suffix
5. append ellipsis when needed

This works for both:

- probe candidate updates
- visible final commits

---

## Finding the Patch Anchor

The patch anchor should be derived from:

> the deepest shared ancestor that still allows simple suffix replacement

Rules:

- patch only at **element child boundaries**
- do not patch at text offsets
- if the only difference is inside the same text node, fall back to the parent element boundary before that text node
- prefer simplicity over minimality

This is important.

We are intentionally **not** trying to preserve identity through text-offset changes.

That would make the system much more complex for little practical benefit.

---

## Patch Primitive

The patch primitive is:

1. resolve `PatchAnchor` in the live tree
2. delete the suffix from that anchor
3. clone the new suffix from `templateRoot`
4. insert the new suffix
5. add ellipsis if the decision is clamped

This is the only update primitive needed in V1.

---

## Why Not `innerHTML`

This design explicitly avoids `innerHTML` in both hot paths:

### Not in binary search

Because repeated candidate updates would still recreate probe subtree content, including `<img>` nodes.

### Not in width-only visible commits

Because that would still recreate the visible subtree once per reclamp.

This redesign only pays off if both of those are removed from the hot path.

---

## Why Not Full DOM Diff

A full structural diff would be too heavy for this component.

It would push the implementation toward:

- editor-like DOM logic
- difficult text-node surgery
- more edge cases than this component needs

That is outside the intended scope.

The suffix replacement model is enough.

---

## Candidate Application API

The rich implementation should expose something like:

```ts
interface RichPatchTarget {
  currentDecision: ClampDecision | null;
  patchTo(decision: ClampDecision): void;
}
```

Where both `probe` and `visible` implement the same contract.

This gives the shared search logic a clean way to drive rich candidate updates.

---

## Recommended Internal Flow

## 1. Source Change

When `html` changes:

1. prepare `PreparedRichSource`
2. create template tree
3. initialize probe target
4. initialize visible target
5. reset decisions
6. run measurement and commit final result

A full rebuild is acceptable here because the source really changed.

---

## 2. Width-Only Reclamp

When width changes:

1. schedule recompute
2. binary-search on the probe target
3. compute `ClampDecision`
4. if decision unchanged, skip visible update
5. otherwise patch visible target once

This path is the main optimization target.

---

## Scheduling

Width-driven recomputes should be coalesced.

Recommended policy:

- observe size changes
- schedule at most one recompute per animation frame
- keep only the latest width per frame

This keeps continuous resize behavior bounded.

---

## Probe and Visible Should Use the Same Patch Logic

This is important.

Do not maintain:

- one candidate pipeline for the probe
- another update pipeline for the visible tree

Instead, both should be driven by the same patch model:

- same decision type
- same patch-anchor logic
- same suffix replacement strategy

That reduces divergence and keeps the implementation understandable.

---

## Images and Resource Behavior

## Main Outcome

This design does **not** guarantee that images are never recreated.

It does guarantee something more realistic and useful:

> images in the stable prefix will no longer be recreated on every candidate update

Only images inside the changed suffix may still be recreated.

That is a major improvement over repeated subtree replacement.

---

## Important Clarification

If binary search still used `innerHTML`, hidden probing alone would **not** solve the repeated image issue.

It would only move the churn into the hidden tree.

So the design must include:

- no `innerHTML` in probe candidate updates
- no `innerHTML` in visible width-only commits

---

## V1 Image Policy

Keep image handling simple:

- preserve the current bounded image-settlement follow-up behavior
- do not add probe-only placeholder logic in V1
- do not add `srcset`-specific patch architecture in V1

Those can be reconsidered later if still needed.

---

## Scope Boundaries for Content

This implementation assumes the component is used for display-oriented rich inline HTML.

It is **not** optimized for:

- interactive form controls
- DOM-attached custom behavior
- embedded widget state
- document-global semantics that depend on stable IDs

This should be documented clearly.

---

## Implementation Plan

## Phase 1: Change Internal Result Type

- replace hot-path `html` result with `ClampDecision`
- rich clamp search returns boundary-based results

## Phase 2: Add Persistent Hidden Probe

- mount hidden probe tree
- move binary search candidate testing onto the probe

## Phase 3: Implement Patch Anchor + Tail Replacement

- define `PatchAnchor`
- implement suffix replacement for a patch target
- use it for visible commits

## Phase 4: Use the Same Patch Model for Probe Candidate Updates

- make probe candidate application fully in-place
- remove candidate `innerHTML` updates

## Phase 5: Keep Current Image Settlement Logic

- reuse current bounded follow-up recompute behavior
- only optimize further if still necessary

---

## Suggested Interfaces

```ts
type NodePath = number[];

type BoundaryPoint =
  | { kind: "text"; path: NodePath; offset: number }
  | { kind: "element"; path: NodePath; childIndex: number };

interface PreparedRichSource {
  templateRoot: DocumentFragment;
  boundaries: BoundaryPoint[];
  fallbackText: string;
}

interface ClampDecision {
  kind: "full" | "clamped" | "fallback";
  boundaryIndex?: number;
  fallback?: string;
}

interface PatchAnchor {
  ancestorPath: NodePath;
  startChildIndex: number;
}

interface RichPatchTarget {
  currentDecision: ClampDecision | null;
  patchTo(decision: ClampDecision): void;
}
```

---

## Behavioral Rules

1. `html` remains the public input
2. width-only reclamps must not use `innerHTML`
3. binary search candidate updates must not use `innerHTML`
4. visible DOM must not be mutated during search
5. probe and visible use the same tail-replacement logic
6. unchanged decisions must skip visible updates
7. patching happens only at safe element child boundaries
8. do not implement text-offset-level identity preservation

---

## Acceptance Criteria

The implementation is successful if:

- rich clamp still accepts `html: string`
- binary search remains aligned with the pure text clamp flow
- probe candidate updates reuse the same DOM tree
- visible width-only updates no longer replace the full subtree
- stable-prefix nodes survive across many reclamps
- repeated image churn is significantly reduced
- the implementation stays small and understandable

---

## Final Recommendation

Implement the new rich clamp around this principle:

> treat width-only reclamp as a boundary-update problem, not an HTML-regeneration problem

In practical terms, that means:

- keep the public API
- keep the shared search flow
- use a persistent hidden probe
- use in-place binary search on the probe
- commit to the visible tree with prefix-preserving tail replacement
- avoid `innerHTML` in both hot paths

This is the most reliable design that solves the real issue without overcomplicating the component.
