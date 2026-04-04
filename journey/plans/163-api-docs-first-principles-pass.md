## Goal

Rework the component API docs from first principles so they feel simpler and easier to read: one short orientation line per component, lightweight metadata, and no dedicated notes section unless it adds unique value.

## Plan

1. Re-evaluate the current API docs structure in `packages/website/src/App.vue` around how readers actually scan component references.
2. Replace the separate notes blocks with concise component summaries, simplify the metadata styling, and clean up awkward labels such as the InlineClamp `Required` treatment.
3. Format the docs and re-run the demo browser test after updating any assertions tied to the old notes layout.
