# 2026-04-08

- Evaluated three long-term architectures for multiline rich-text support:
  - one public `LineClamp` with one shared shell and two engines
  - separate `LineClamp` and `RichLineClamp` with a large shared shell
  - separate `LineClamp` and `RichLineClamp` with only small shared utilities
- Chosen direction: separate public `LineClamp` and `RichLineClamp`, with small shared utilities
  only.
- Reasoning:
  - text and rich modes are different component contracts, not just different engines
  - the mixed shared shell remains the main complexity sink even after engine extraction
  - a large shared shell would preserve too much abstraction tax
  - a dedicated `RichLineClamp` clarifies docs, props, warnings, and maintenance boundaries
- Compatibility direction:
  - add `RichLineClamp`
  - keep `LineClamp html` working temporarily as a thin compatibility delegation path
  - make `RichLineClamp` the preferred documented surface for rich content
