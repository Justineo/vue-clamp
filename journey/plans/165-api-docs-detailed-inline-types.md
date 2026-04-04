## Goal

Make the inline API docs self-sufficient: explain generic `T` concretely where it is introduced, document slot props inline with types and meanings, and fully describe the `split()` return shape on the prop itself.

## Plan

1. Expand the `WrapClamp` `items` and slot descriptions so `T` is explained as a user-supplied item shape with a concrete example.
2. Rewrite slot descriptions to include type and behavior details for each slot prop inline.
3. Expand the `InlineClamp` `split` prop description to document `start`, `body`, and `end` directly, then format and re-run the demo browser test.
