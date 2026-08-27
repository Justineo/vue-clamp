# Pretext width-discovery exploration

Exact predictive clamping depends on source text, font, line limit, and content-box inline size. The
last input cannot be inferred from authored styles: padding, box sizing, constraints, percentages,
and inherited CSS all affect it. Three width-discovery paths were evaluated under the stricter
invariant that collapsed content may exist in the DOM but must not paint beyond its limit.

## Rejected controlled width

An optional authoritative `inlineSize` prop eliminated observation in a controlled benchmark and
reduced summed active time by 81.9%. It was still the wrong public contract. Ordinary component
callers do not own the final content-box width; asking them to add another observer only moves the
same work outward. In the 200-instance workload, pushing one reactive ancestor width through every
child caused 4,800 VNode updates, versus 101 for smooth changes and 3,200 for jumps with shared
observation. Wall time remained effectively equal. The prop and controlled benchmark were removed.

## Rejected synchronous read

Reading geometry on mount and component updates discovered width synchronously but interleaved layout
reads with reactive writes. The 200-instance jump workload regressed from about 225 ms to 540 ms.
Parsing inline width was also rejected because it cannot establish actual content-box size across CSS
constraints.

## Retained pre-paint delivery

The Resize Observer processing model recalculates layout, delivers active observations, recalculates
layout again when callbacks mutate DOM, and only then updates rendering. The component therefore
mounts safely contained DOM, receives exact width from the browser, and commits the Pretext prefix
inside the callback before paint. The visible source stays `visibility: hidden` until that first
delivery; native line clamp and overflow clipping then contain stale predictions. An `Nlh` height cap
was rejected because tall atomic inline boxes can expand real line boxes beyond computed line height.

Two DOM changes make that callback minimal:

- The accessible full source and `aria-hidden` visible text nodes stay mounted in every state. Width
  delivery mutates the existing visible text node directly and never needs a Vue component patch.
- A zero-height width probe is observed instead of the text body. It follows the same content width
  but cannot change block size when text changes, eliminating resize feedback deliveries.

In the 200-instance benchmark, the stable DOM reduced smooth mutations from 202 to 101 and jump
mutations from 7,200 to 4,000; VNode updates fell to zero in both profiles. The width probe reduced
the focused English jump case from 39 resize callbacks to 27 and changed active time from a 12.8%
regression to a 57.5% reduction relative to root. It adds one empty, hidden DOM node per instance but
no public state or configuration.

Sync watcher flushing, result caches, typed rank arrays, `layout()` prepasses, and independent
observers had no reproducible benefit. The remaining meaningful computation optimization belongs
upstream in Pretext: its public line walker allocates result and cursor objects, while the local
wrapper is already a small share of hot-path time.
