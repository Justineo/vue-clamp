# Benchmark Row Previews

## Goal

Show a concrete representative fixture when a benchmark scenario row is expanded, instead of only textual scenario details.

## Steps

1. Add a small preview component that renders one representative state for each benchmark engine.
2. Support alternate preview states for resize, text-update, and slot-update scenarios.
3. Embed the preview in expanded scenario rows and keep the layout compact.
4. Validate with `vp fmt`, `vp check`, `vp test`, and `vp run build -r`.
