# 088 VoidZero Minimal Demo Pass

## Goal

Reduce the website from a lightweight marketing page to a minimal demo/docs page with less copy, fewer headings, and a calmer visual system.

## Visual Thesis

Technical brochure: pale canvas, restrained terminal-like accents, thin dividers, mono utility labels, and one subtle blue-green glow drawn from current VoidZero family sites.

## Content Plan

- Masthead: package name, one-line description, install command, direct links
- Demo: one workspace with scenario tabs, compact controls, and one measured render stage
- Usage: install plus one Vue SFC snippet
- API: flat grouped reference for props, slots, and events

## Interaction Thesis

- Scenario switching stays immediate and local to one measured stage
- Controls remain close to the output so each change is obvious
- Motion stays limited to hover/focus feedback and a subtle top-surface accent

## Visual Language References

- [VoidZero](https://voidzero.dev/)
- [Vite](https://vite.dev/)
- [Vitest](https://vitest.dev/)
- [Oxc](https://oxc.rs/)

Shared traits to absorb as an inference:

- short functional headings instead of marketing statements
- strong spacing and borders over layered card chrome
- mono utility labels and code-first cues
- restrained accent gradients used as atmosphere, not decoration

## Scope

- `packages/website/src/App.vue`
- `packages/website/src/style.css`
- `journey/design.md`

## Plan

1. Remove redundant intro facts, showcase copy, and secondary descriptive headings from the website template.
2. Rebuild the top of the page as a compact masthead with install and repository actions.
3. Simplify the playground header and scenario presentation so the controls and measured stage are primary.
4. Flatten the reference sections into cleaner docs-style blocks with reduced copy.
5. Run `vp check`, `vp test`, and `vp run build -r`, then update journey memory if the website direction changed.
