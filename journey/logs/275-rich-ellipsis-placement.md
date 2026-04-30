# Rich ellipsis placement log

Date: 2026-04-30

## Decision

`RichLineClamp` should treat ellipsis as an outer clamp marker, not as text owned by the deepest
inline element at the truncation point.

When a cut happens inside `<code>release-candidate</code>`, the retained structure should render as
`<code>release</code>…`, not `<code>release…</code>`.

## Implementation

- Simplified rich clone patching so it returns only the retained fragment.
- Appended clamped ellipsis to the rich `body` root as a plain text node.
- Removed the previous root-level ellipsis before reclamping from one clamped decision to another,
  so width changes do not duplicate the marker.
- Added browser coverage for truncating inside a retained `<code>` element and reclamping without
  duplicate ellipses.
