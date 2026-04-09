# 2026-04-09

- Converting the simplified surface guide into a grid:
  - keep the short chooser copy
  - present the four surfaces as simple responsive tiles
  - avoid bringing back the earlier table-like metadata
- Implemented:
  - converted the guide list into a responsive 2-up grid on wider screens
  - made each surface entry a single linked tile
  - kept the content model unchanged: just the component name and one concise chooser sentence
- Follow-up polish:
  - removed the soft card feel and switched the guide to a sharper bordered grid
  - changed the lead copy to describe the four components directly instead of framing the section as
    a chooser prompt
  - removed the dedicated section heading and kept the guide as lead copy plus the grid itself
  - replaced the corner marks with one tiny solid accent triangle per tile
  - changed the triangle to the standard border color by default
  - added a separate pseudo-element border overlay so hover / focus can highlight the whole cell
  - switched the triangle from a clipped square to a real border triangle so the corner meets the
    grid lines without an anti-aliased seam
  - raised the hovered / focused tile above its siblings so the active outline is not clipped by
    neighboring corner triangles
  - removed the shared rounded focus-ring shadow from the grid tiles and kept keyboard focus as a
    sharp square border treatment
  - explicitly neutralized the global anchor focus radius/shadow on the grid cells so they stay
    square when keyboard-focused
