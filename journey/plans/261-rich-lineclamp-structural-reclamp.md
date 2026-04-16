# 261 RichLineClamp structural reclamp

## Goal

Implement the essential vNextNext rich clamp direction from the research note while keeping the code small:

- keep `html: string` as the public API
- stop using HTML strings as the width-only reclamp result
- move rich binary search onto a hidden probe tree
- commit visible rich output with the same structural patch primitive used by the probe
- preserve the current image-settlement behavior without adding image placeholders or `srcset` handling

## Scope

1. Change `rich.ts` so the clamp result is a structural decision instead of final HTML.
2. Add a small prefix-preserving tail-replacement patch primitive.
3. Update `RichLineClamp` to render a visible rich span plus a hidden probe span.
4. Keep Vue responsible for the shell and source changes, but not width-only rich body updates.
5. Update rich tests and benchmarks for the new result shape.

## Simplification constraints

- Do not add a general DOM diff engine.
- Do not preserve identity inside the changed tail.
- Do not add image placeholder substitution in this pass.
- Do not alter `LineClamp` or the shared multiline shell unless necessary.
