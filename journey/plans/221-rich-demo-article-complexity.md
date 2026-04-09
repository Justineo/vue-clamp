# Plan

## Goal

Make the website `RichLineClamp` demo cover denser, article-like inline markup instead of only
note-style snippets.

## Steps

1. Replace or expand a rich-html preset in `packages/website/src/App.vue` so the demo includes more
   complex inline structure such as bold text inside a link and layered article metadata.
2. Update the website browser test to assert the new nested inline structure instead of only the
   simpler rich-note cases.
3. Run validation and update `journey/design.md` plus the session log.
