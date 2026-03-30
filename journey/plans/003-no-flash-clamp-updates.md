# No-Flash Clamp Updates

Date: 2026-03-29

## Goal

Eliminate transient renders where `vue-clamp` shows raw or stale full text before the final clamped result is applied during text changes, width changes, and initial mount.

## Findings

- The current component defers recomputation with `requestAnimationFrame`, which guarantees at least one visible frame of stale content after resize-driven updates.
- Slot text updates temporarily write the full new raw text into `displayedText` before the next clamp pass runs.
- The render fallback to `currentText` means the initial unclamped slot content can be inserted before the first measured clamp result is available.

## Actionable Steps

- [completed] Replace frame-delayed recompute scheduling with a same-tick queued recompute model.
- [completed] Stop assigning the raw updated slot text into the rendered output while a clamp recompute is still pending.
- [completed] Harden collapsed styling so `max-lines` content stays clipped during width changes even before the next clamp text is committed.
- [completed] Add regression tests that assert transient states do not expose the unclamped full text after text and width updates.
- [completed] Run `vp check`, `vp test`, and `vp run build -r`.
- [completed] Update journey logs and the canonical design snapshot with the new no-flash rendering guarantees.
