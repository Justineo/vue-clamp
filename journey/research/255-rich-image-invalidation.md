# Rich image invalidation in `RichLineClamp`

## Purpose and status

This note is intended for external review. It should be readable without prior chat context.

Current branch status on April 12, 2026:

- the speculative public type-shape change has already been reverted
- the branch still carries an experimental image-listener patch in the rich multiline component
- that patch is under evaluation and should not be treated as an accepted final design

The concrete question for review is:

> How should `RichLineClamp` invalidate after descendant image settlement, given that the rich clamp
> engine mutates the live DOM during binary-search probing and final commit?

## Executive summary

`RichLineClamp` has a real image-load invalidation problem, but the current container-capture patch
is not a safe final answer.

The original implementation attached `load` / `error` listeners to the current descendant `<img>`
elements only. That breaks when the rich clamp engine mutates the live
rich body during recompute: the DOM nodes can be replaced even when the final `visibleHtml` string
does not change, so the old listeners become attached to dead elements and the current connected
images are left unwatched.

The current review-driven patch switches to capture-phase listeners on the stable rich container.
That fixes the listener-orphaning hole, but browser experiments show that every newly created
`<img>` element dispatches its own `load`, even when the source URL is unchanged and already cached.
Because the shared multiline shell allows direct image-driven invalidations to bypass the
layout-signature dedupe used for `ResizeObserver`, a container listener can feed a self-sustaining
recompute chain if a load event
causes the subtree to recreate the same connected image again.

The right conclusion is:

- the original review comment identifies a real correctness hole
- the current capture-listener patch is directionally useful but too blunt
- the next runtime change should be a more explicit image-settlement design, not a raw permanent
  ancestor listener

## Runtime variants being compared

This report compares two concrete listener strategies.

### Variant A: original per-image listener model

Before the review-driven patch, `RichLineClamp`:

- queried the current descendant `<img>` elements
- filtered to incomplete images
- attached `load` / `error` listeners to those image nodes directly

That model was narrow and low-noise, but it assumed the watched image nodes would remain the active
connected nodes until settlement.

### Variant B: current experimental ancestor-capture patch

The current branch instead:

- attaches one capture-phase `load` listener to the stable rich container
- attaches one capture-phase `error` listener to the same container
- schedules a fresh reclamp whenever the event target is an `HTMLImageElement`

That model survives descendant replacement, but it widens the event surface and changes the loop
properties of the system.

## Evidence classification

This report uses three evidence labels:

- `Observed in internal implementation review`: direct reading of the current unpublished source
- `Observed in browser experiment`: reproduced in a narrow local Playwright harness
- `Inference`: a conclusion drawn from the implementation review and browser observations, but not yet isolated
  in a component-level browser test

The key claims below are labeled informally in that way so an external reviewer can separate facts
from risk assessment.

Because the implementation is not public yet, this document intentionally avoids file paths and line
references. Internal-behavior claims should be read as maintainer-supplied observations from the
current branch.

## Background

### Current rich clamp flow

The rich multiline component uses a shared lifecycle shell for mount/update reclamps, resize
invalidation, and font-load invalidation. That shell stores a settled layout signature and only
lets `ResizeObserver` trigger work when the observed frame geometry changes, but direct
image-driven invalidations always enqueue a fresh recompute.

The rich clamp engine does not measure in a detached probe. It mutates the live rich body while
searching:

- it may restore the full source HTML into the live rich body
- it builds candidate prefix fragments and commits them with descendant replacement
- the binary search can apply several candidate fragments during one recompute

That is important because image listeners are tied to DOM node identity, not just to the `src`
string or the final serialized HTML.

### Minimal architecture sketch

At a high level, the component behaves like this:

1. A recompute is requested.
2. The rich clamp engine mutates the connected rich-content DOM to test candidate cut points.
3. The engine settles on a final visible result.
4. Reactive state is updated only if the final serialized result differs from the existing one.
5. If the serialized result is unchanged, Vue may not rerender even though the connected descendant
   nodes were replaced during the recompute.

That last point is the heart of the listener-orphaning problem.

### Why image-driven invalidation exists at all

It is tempting to rely only on `ResizeObserver`, but that is weaker than the current design goal.
Image and font loads can change internal inline layout without necessarily producing the clean
frame-geometry change that the shell watches for observer dedupe. This is the same reason the shell
already has explicit font-load invalidation instead of trusting resize alone.

For rich content, image loading can affect:

- line-breaking around an atomic inline image
- whether the image still fits on the current line
- the amount of trailing text that can remain before ellipsis

Those are clamp-boundary concerns, not just box-size concerns.

## The original bug

### Original listener model

The pre-review implementation scanned the current rich DOM, selected the current `<img>` elements,
and attached `load` / `error` listeners only to incomplete images.

That model is reasonable only if the image DOM identity remains stable until either:

- the image settles, or
- the effect reruns and rebinds listeners to the replacement nodes

### Where it breaks

The clamp engine can replace descendants even when the component’s reactive state does not change.
The important sequence is:

1. A fresh reclamp runs because of width, slot, observer, or font invalidation.
2. The rich clamp engine mutates the connected rich-content container directly through descendant
   replacement and or `innerHTML`.
3. The chosen final result serializes to the same `visibleHtml` string and the same
   `isClamped` / `isFallback` state as before.
4. The component sees no reactive change, so there is no Vue rerender and no new image-binding
   effect pass.
5. The current connected `<img>` elements are new DOM nodes, but the old listeners are still
   attached to the discarded ones.

That means the original model can silently stop watching the current visible images.

Evidence level: `Observed in internal implementation review`.

## Why this is not just a Vue rerender question

An outside reader might reasonably ask why `watchPostEffect` does not simply rerun and rebind.

The important detail is that the rich engine mutates DOM inside one recompute pass independently of
Vue's render pipeline:

- the rich clamp engine mutates the connected rich container directly
- the final serialized HTML can remain identical to the existing `visibleHtml`
- the component then sees no reactive change and does not force another Vue render

So this is not merely "Vue will rerender after load". The failure mode exists specifically because
the rich engine can replace connected descendants without changing the reactive state that the
effect depends on.

Evidence level: `Observed in internal implementation review`.

## Browser experiments

All experiments below were run locally on April 12, 2026 with the repo’s Playwright dependency.
They are intentionally minimal DOM-level experiments, not full component tests. Their job is to
answer browser-behavior questions that the component design depends on.

### Experiment 1: Does descendant image `load` reach an ancestor listener?

Result:

- capture listener on ancestor: yes
- bubble listener on ancestor: no
- target listener on the image itself: yes

Observed result:

```json
{
  "propagation": {
    "capture": 4,
    "bubble": 0,
    "target": 1
  }
}
```

Interpretation:

- `load` is usable through capture on an ancestor container
- it is not usable through ordinary bubbling

This validates the basic mechanism behind the current capture-listener patch.

Evidence level: `Observed in browser experiment`.

### Experiment 2: Does recreating the same image fire `load` again?

Result: yes.

Observed result for three consecutive recreations of the same `src`:

```json
{
  "repeated": {
    "capture": 3,
    "target": 3
  }
}
```

Interpretation:

- `load` is per element instance, not per URL
- replacing an `<img>` with a fresh `<img src=\"same-url\">` gives a fresh `load`
- this remains true even for a reusable cached-like source such as a data URL

That is the core loop risk for the current capture-listener patch.

Evidence level: `Observed in browser experiment`.

### Experiment 3: What happens if an image is removed before it finishes loading?

Result:

- the detached image still fires its own target `load`
- the former ancestor capture listener does not receive it

Observed result:

```json
{
  "counts": {
    "capture": 0,
    "target": 1
  },
  "imgComplete": true,
  "isConnected": false
}
```

Interpretation:

- transient probe images removed by `replaceChildren()` do not, by themselves, feed a stable
  ancestor capture listener after detachment
- the real risk is the final connected image that survives into the visible DOM

Evidence level: `Observed in browser experiment`.

### Experiment 4: Can a load-triggered rerender chain itself?

Result: yes.

In a small DOM-only harness, a capture listener that rerendered the same `<img>` on each `load`
produced a continuing chain:

```json
{
  "loads": 4,
  "renders": 4
}
```

Interpretation:

- a stable ancestor capture listener plus “rerender same image on load” is sufficient to create a
  feedback loop
- `RichLineClamp` is not that exact harness, but its current patch now has the same structural
  ingredients:
  - stable ancestor listener
  - load-triggered `requestRecompute()`
  - recompute path that recreates descendant image nodes

Evidence level:

- the harness behavior itself is `Observed in browser experiment`
- the claim that the current branch has the same structural ingredients is `Observed in internal implementation review`
- the claim that the component can therefore loop is an `Inference` until isolated in a dedicated
  component test

## Implications for the current branch

### What the current capture patch gets right

The current experimental patch fixes the specific orphaned-listener issue from the review:

- it stays attached while the rich body replaces descendants
- it can catch `load` / `error` on the final connected image nodes even if no reactive rerender
  happens afterward

That part is good.

Evidence level: `Observed in internal implementation review`.

### What it gets wrong

The patch treats every descendant image `load` / `error` as an unconditional reason to run another
reclamp.

That is risky because:

- direct image-driven reclamps are not deduped against the settled layout signature
- every clamping recompute can recreate connected `<img>` nodes
- every recreated `<img>` can emit a fresh `load`

So the current patch is vulnerable to repeated “image load -> recompute -> recreate image -> image
load” chains.

Evidence level: `Inference`, supported by the browser experiments above.

### Why the current tests do not prove safety

The current browser fixture uses a data URL image with explicit inline `width` and `height`. That
is good for markup-preservation coverage, but weak for this problem:

- the image has explicit dimensions, so intrinsic-size settlement is less meaningful
- the tests do not assert that exactly one post-load recompute occurs
- the tests do not stress cached-image recreation or no-reactive-change recomputes

So the present suite does not resolve the design question.

Evidence level: `Observed in internal implementation review`.

## Solution space

### Option 1: Keep stable ancestor capture, but add explicit settlement arming and dedupe

Idea:

- keep the stable capture listener on `htmlElement`
- track whether the current connected DOM still has unsettled images worth waiting on
- allow at most one image-driven recompute per settlement generation
- disarm once the generation has been serviced

Pros:

- preserves the key advantage of capture: it survives descendant replacement
- can catch very early load events on newly inserted connected images

Cons:

- easy to get subtly wrong
- requires a clear generation model so cached recreated images do not re-arm forever
- still needs a policy for “already complete right after commit” images

Assessment:

- promising, but only with a carefully designed state machine
- a raw always-on capture listener is not enough

### Option 2: Rebind only the current incomplete images after every recompute generation

Idea:

- return to per-image listeners
- explicitly refresh bindings after every recompute completion, even when `visibleHtml` is
  unchanged
- do not rely on Vue rerender alone to trigger the rebinding pass

Pros:

- listeners remain narrowly scoped to the actual images we care about
- avoids a permanent ancestor event surface

Cons:

- risks missing very fast load events between DOM replacement and the rebinding pass
- needs a non-reactive “recompute generation finished” hook
- still needs a strategy for images that are already complete by the time rebinding runs

Assessment:

- clearer than a permanent capture listener
- not obviously robust to cache-hit timing without extra logic

### Option 3: Use `MutationObserver` to track the current connected image set

Idea:

- observe child-list changes in the rich body
- whenever the clamp engine replaces descendants, rescan the current connected images
- attach one-shot listeners only to the current incomplete images

Pros:

- directly follows the actual DOM mutation source of the problem
- decouples the image rebinding pass from Vue rerender timing

Cons:

- the clamp engine performs many synchronous probe writes during binary search, so the observer will
  see a noisy stream of transient states
- still has the same “cache hit before rebinding” problem unless paired with extra logic
- adds another observer to an already observer-driven component

Assessment:

- workable, but probably more complexity than it earns

### Option 4: Remove explicit image listeners and rely only on resize invalidation

Idea:

- delete image listeners entirely
- let `ResizeObserver` and normal prop/width invalidation carry the feature

Pros:

- simplest implementation
- no listener-orphaning and no load-loop risk

Cons:

- correctness regression risk when image load changes inline layout without producing a useful frame
  resize signal
- contradicts the current design intent of explicit image-driven reclamping

Assessment:

- good as a fallback simplicity option only if we accept weaker correctness

### Option 5: Reduce DOM identity churn during rich recompute

Idea:

- change the clamp engine so idempotent recomputes do not recreate the same final connected image
  nodes unnecessarily
- keep image invalidation narrower because the current committed image set would stay more stable

Pros:

- attacks the loop cause at the source
- likely reduces DOM churn beyond the image problem

Cons:

- harder algorithmic change
- does not remove the need to define image settlement semantics
- rich probing still needs temporary writes unless the measurement model changes more deeply

Assessment:

- valuable optimization direction, but not the smallest fix for the current review comment

## Recommended direction

Do not ship the current unconditional ancestor-capture patch as the final design.

The most defensible next step is a hybrid of option 1:

1. keep a stable capture listener because descendant replacement is real
2. make image-driven recompute explicitly generation-based rather than unconditional
3. only arm the generation when the current connected DOM has images that are not yet settled
4. service at most one image-driven recompute per armed generation
5. add a targeted browser test that uses a delayed image without fixed dimensions and asserts the
   component settles after load instead of reclamping indefinitely

That keeps the correctness goal while acknowledging the browser behavior observed in the
experiments.

## What an external reviewer should pressure-test

If this report is handed to a third-party researcher, the most valuable review questions are:

1. Is the orphaned-listener bug analysis sound, especially the "DOM replaced with no reactive
   change" path?
2. Is the loop-risk argument strong enough as written, or does it require a component-level
   reproduction before we should treat it as blocking?
3. Is generation-based arming actually the right next design, or is there a simpler contract such
   as dropping explicit image listeners entirely?
4. What is the best definition of "image settlement" for this component's purposes?
5. Is there a lower-churn rich commit strategy that would remove enough DOM identity churn to
   simplify the invalidation problem at the root?

## Reproducibility notes

The browser observations in this note came from small local Playwright harnesses. They were not run
through the production component directly; they were used to answer browser-semantics questions
that the component design depends on.

The essential experiments were:

1. descendant image `load` propagation to ancestor capture vs bubble listeners
2. repeated recreation of the same `<img src>` node
3. removal of an in-flight image before settlement
4. an intentionally synthetic "load -> rerender same image" feedback harness

The exact numeric outputs are recorded above because they are the durable part of the evidence. If
needed, the harnesses can be moved into a checked-in test or appendix later.

## Open questions

- What is the best definition of “settled” for a current connected image generation:
  - `complete`
  - `complete && naturalWidth > 0`
  - first `load` / `error`
- Do we want to treat explicit-width images differently from intrinsic-size images to reduce
  unnecessary reclamps?
- Is the simpler product trade-off actually to drop explicit image listeners and rely on resize,
  accepting a narrower correctness envelope?
