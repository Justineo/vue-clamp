# 090 VoidZero-Inspired Visual Redesign

## Goal

Restyle the vue-clamp demo site with VoidZero ecosystem visual language while keeping the existing layout structure.

## Design Principles (from actual VoidZero sites)

1. **Light mode default** with `prefers-color-scheme: dark` support
2. **Flat surfaces** with thin outline borders (`#E5E4E7` light / `#2e2f36` dark)
3. **No glassmorphism** — no `backdrop-filter`, no gradients, no glow effects
4. **Small border-radius** — 6px for buttons/inputs, 8px for cards, 4px for badges
5. **Inter** for body, system monospace for code
6. **Green brand** — `#00875a` light / `#34d399` dark (Vue ecosystem green)

## Token Reference

Derived from `@voidzero-dev/vitepress-theme`:

- Backgrounds: white / `#16171d`
- Soft bg: `#f6f6f7` / `#1e1f26`
- Text primary: `#1a1a1e` / `#ededef`
- Text secondary: `#5c5c66` / `#a1a1aa`
- Stroke: `#e5e4e7` / `#2e2f36`

## Layout (unchanged)

- Two-column hero (copy | meta)
- Two-column workspace (sidebar controls | live preview)
- Two-column docs grid (usage | API)
- Sticky header, simple footer

## Files Changed

- `packages/website/src/style.css` — complete rewrite (tokens, flat surfaces, light/dark)
- `packages/website/src/App.vue` — header split into wrapper+inner for full-width sticky bar
