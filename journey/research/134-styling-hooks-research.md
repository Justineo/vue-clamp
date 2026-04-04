# Styling hooks research

## Question

We need a unified way for users to target meaningful internal parts of `LineClamp`, `InlineClamp`, and `WrapClamp` with custom CSS, without forcing them to rely on fragile DOM structure selectors.

The goal is not theming-by-prop. The goal is stable styling hooks.

## Current audit

### Library surface today

- `LineClamp` has no documented internal styling hooks.
- `InlineClamp` renders:
  - root
  - `data-inline-start`
  - `data-inline-body`
  - `data-inline-end`
- `WrapClamp` renders:
  - `data-wrap-content`
  - `data-wrap-before`
  - `data-wrap-item`
  - `data-wrap-after`
- Root state such as `clamped`, `expanded`, or native-vs-JS mode is not exposed as DOM styling state.

### Problems with the current shape

- The three surfaces are inconsistent:
  - `LineClamp` has nothing
  - `InlineClamp` has `data-inline-*`
  - `WrapClamp` has `data-wrap-*`
- The current names encode component identity directly into each selector, which becomes verbose and irregular.
- The current hooks are incomplete:
  - `WrapClamp` exposes `content`, but `LineClamp` does not expose an equivalent internal body/content hook.
  - No surface exposes stable root state hooks.
- The website already styles against these internals, for example in [App.vue](/Users/yiling.gu@konghq.com/Developer/Justineo/vue-clamp/packages/website/src/App.vue), so undocumented DOM details are already acting like public API.

### DOM anatomy by component

#### `LineClamp`

Current meaningful parts:

- root: `props.as`
- content flow wrapper
- optional `before` slot wrapper
- text/body wrapper
- optional `after` slot wrapper

There is also a visually-hidden full-text node in the JS clamp path. That should stay an implementation detail, not a public styling part.

#### `InlineClamp`

Current meaningful parts:

- root
- optional `start`
- `body`
- optional `end`

#### `WrapClamp`

Current meaningful parts:

- root
- content flow wrapper
- optional `before`
- repeated `item`
- optional `after`

## External patterns

### Ark UI

Ark UI uses a clear anatomy model:

- `data-scope="<component>"`
- `data-part="<part>"`
- `data-state="<state>"` for relevant state

Example from their styling guide:

```html
<div data-scope="accordion" data-part="item" data-state="open"></div>
```

This is a strong fit for headless or semi-headless components because it gives users stable selectors without forcing library-owned class names.

Source:

- [Ark UI styling guide](https://ark-ui.com/docs/guides/styling)

### React Aria

React Aria exposes:

- default root class names
- explicit data attributes for state such as `data-selected` and `data-focused`
- `slot` naming where multiple identical subparts exist
- CSS variables only when the component computes useful geometry

Two ideas are especially relevant here:

- Boolean states are often better as presence attributes than a single overloaded `data-state`.
- CSS variables are worth adding only when the component truly computes something users want to consume in CSS.

Source:

- [React Aria styling](https://react-spectrum.adobe.com/react-aria/styling.html)

### Radix Primitives

Radix keeps parts user-styled via classes, and exposes state through `data-state`.

The useful lesson here is narrower:

- state hooks should be explicit and stable
- the library should not overstyle or hide the state model

Source:

- [Radix styling guide](https://www.radix-ui.com/primitives/docs/guides/styling)

### Material UI

Material UI uses slot-oriented global classes like `.MuiSlider-thumb` and state classes like `.Mui-selected`.

The most useful guidance here is about selector scoping:

- state hooks should always be combined with component/slot context
- do not encourage global state-only selectors

That maps well to a `data-scope` plus part/state model.

Source:

- [MUI customization guide](https://mui.com/material-ui/customization/how-to-customize/)

### MDN: `::part()` and `:dir()`

Two platform notes matter:

- `part` / `::part()` is a Shadow DOM mechanism. It is not the right primary API for our regular light-DOM Vue components.
- `:dir(rtl)` is a better hook than `[dir=rtl]` when direction may be inherited.

Sources:

- [MDN: CSS shadow parts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Shadow_parts)
- [MDN: `:dir()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:dir)

## Strategies considered

### 1. Do nothing and let users target raw DOM structure

Example:

```css
.article-excerpt > span > span:last-child { ... }
```

Why this is bad:

- brittle
- unreadable
- blocks internal refactors
- already inconsistent across surfaces

Rejected.

### 2. Expose stable library classes for every part

Example:

```html
<span class="vc-line-clamp__after"></span>
```

Pros:

- familiar
- easy to inspect in devtools

Cons:

- pushes us toward a naming-scheme API we need to version forever
- feels heavier and more framework-era-specific than necessary
- invites direct class overrides as primary styling strategy
- duplicates the user’s own root `class`

Possible, but not the best fit.

### 3. Use `data-scope` + `data-part` + state attributes

Example:

```html
<span data-scope="wrap-clamp" data-part="after" data-clamped></span>
```

Pros:

- matches strong existing headless-library precedent
- consistent across all three surfaces
- works with plain CSS, CSS modules, CSS-in-JS, and utility selectors
- makes state explicit without inventing prop APIs
- keeps root `class` / `style` free for user ownership

Cons:

- slightly more verbose in devtools
- adds some DOM noise

This is the best fit.

### 4. Add prop-driven part class injection or `slotProps`

Example:

```ts
partClass={{ after: "my-after" }}
```

Pros:

- ergonomic in component code
- can be nice for CSS modules

Cons:

- much larger API surface
- has to be typed and documented per component
- overlaps awkwardly with existing content slots
- still does not solve the need for stable default selectors

This could be a later enhancement if real demand appears, but it should not be the foundation.

## Recommendation

### Public styling-hook contract

Adopt one unified anatomy model:

- `data-scope="<component-name>"`
- `data-part="<part-name>"`
- boolean state attributes for orthogonal state

Use kebab-case component scopes:

- `line-clamp`
- `inline-clamp`
- `wrap-clamp`

### Why boolean state attributes instead of a single `data-state`

`LineClamp` and `WrapClamp` have multiple independent dimensions:

- clamped vs unclamped
- expanded vs collapsed
- native vs JS path for `LineClamp`

Those do not fit cleanly into a single exclusive `data-state` value.

So the better model is:

- `data-clamped`
- `data-expanded`
- `data-native`

Only add a state attribute when it is independently meaningful.

### Proposed stable parts

#### `LineClamp`

- `root`
- `content`
- `before`
- `body`
- `after`

Stable root states:

- `data-clamped`
- `data-expanded`
- `data-native`

Do not expose the hidden accessibility source node as a public part.

#### `InlineClamp`

- `root`
- `start`
- `body`
- `end`

Possible root state:

- `data-split` when `split` is provided

This is optional. It is useful only if we think users will style semantic-split mode differently.

#### `WrapClamp`

- `root`
- `content`
- `before`
- `item`
- `after`

Stable root states:

- `data-clamped`
- `data-expanded`

### Selector examples

```css
.article-excerpt [data-scope="line-clamp"][data-part="after"] {
  margin-inline-start: 0.5ch;
  color: var(--accent);
}

.download-name [data-scope="inline-clamp"][data-part="end"] {
  color: var(--muted-accent);
}

.reviewers [data-scope="wrap-clamp"][data-part="item"] {
  border-radius: 999px;
}

:dir(rtl) [data-scope="wrap-clamp"][data-part="after"] {
  margin-inline-start: 0;
  margin-inline-end: 0.5rem;
}
```

## Additional recommendations

### Keep root `class` / `style` user-owned

Continue to let users style the root through normal Vue attrs:

- `class`
- `style`

Then let them target internal parts through the stable data hooks.

### Do not use `part` / `::part()` as the API

Because these are light-DOM Vue components, not Shadow DOM custom elements, `part` would suggest the wrong styling model.

### Do not expose every internal node

Only expose semantically meaningful parts that we are prepared to support as public contract.

That means:

- expose `body`
- do not expose the hidden accessible-source span
- do not expose measurement-only nodes if we add any later

### Document the contract explicitly

The docs should state:

- which `data-scope` / `data-part` values are stable
- which state attributes are stable
- that DOM nesting itself is not part of the public contract

## Migration notes

Current ad-hoc hooks such as:

- `data-inline-start`
- `data-inline-body`
- `data-inline-end`
- `data-wrap-content`
- `data-wrap-before`
- `data-wrap-item`
- `data-wrap-after`

should be replaced by the unified anatomy attributes.

Recommended rollout:

1. Add the new hooks.
2. Update the website and README examples to use only the new hooks.
3. Keep the old ad-hoc hooks temporarily for compatibility.
4. Remove the old hooks in the next breaking cycle if we want a cleaner DOM.

## Bottom line

The best-practice direction is not more props. It is a clearer anatomy contract:

- stable `data-scope`
- stable `data-part`
- explicit root state attributes

That gives users a unified styling API across all clamp surfaces while keeping the component internals refactorable.
