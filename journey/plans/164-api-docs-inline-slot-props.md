## Goal

Simplify the API docs so slot props and `split()` details live where readers expect them: inside the slot or prop they belong to, without extra sections or duplicated metadata.

## Plan

1. Remove the standalone slot-prop sections and move those details into the slot descriptions.
2. Remove the standalone `split()` result section and document its shape directly on the `split` prop.
3. Normalize the API typography and metadata alignment, then format and re-run the demo browser test.
