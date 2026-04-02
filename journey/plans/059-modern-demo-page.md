# 059 - Modern Demo Page

## Goal

Rebuild the website App.vue as a modern demo page inspired by VoidZero's design language while preserving the same demo structure from the old master branch.

## Design Language

- Light background with near-black text, subtle grey borders as visual separators
- Inter for body, monospace for code and component name
- Purple accent (#7c3aed) for interactive elements
- Compact layout, generous but not excessive padding
- No emojis, no shadows — borders and structure do the visual work
- Responsive: max-width container, centered

## Structure

1. **Hero**: `<vue-clamp>` name, one-line tagline, GitHub link
2. **Features**: Compact bullet list
3. **Demo sections** (4, matching old page):
   - max-lines + after slot toggle
   - max-height + before slot + external expanded control
   - clampchange event
   - ellipsis + location
4. **Usage**: Installation + code example with highlight.js
5. **API reference**: Props, Slots, Events tables
6. **Footer**: Credits

## Vue 3 API Adaptations

- `import { Clamp } from 'vue-clamp'`
- `text` prop instead of default slot for text
- `v-model:expanded` instead of `.sync`
- Same `before`/`after` slots with `{ expand, collapse, toggle, clamped, expanded }`
