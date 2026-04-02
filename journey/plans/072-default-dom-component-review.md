# Default DOM Component Review

## Goal

Review the default DOM-based component for unnecessary state, accidental abstraction, and realistic simplification opportunities without reintroducing a shared-shell architecture.

## Questions

1. Which internal states are actually required?
2. Which states are newer than the Vue 2 implementation, and why?
3. Is `clamp mode` a useful abstraction or just vocabulary over a small branch table?
4. What can still be simplified in the default component?
5. Which shared extractions would help the fast component without rebuilding the old abstraction layer?

## Status

- Completed on 2026-04-01.
- Review notes were recorded in the matching log file.
