# 168 Wrap Slot Prop Trim

## Goal

Simplify `WrapClamp` slot props by keeping `hiddenItems` and removing the derived
`visibleCount` and `hiddenCount` fields.

## Steps

1. Update `WrapClampSlotProps` and the runtime slot prop factory to remove the two count fields.
2. Update docs, examples, and tests to derive counts from `hiddenItems.length`.
3. Refresh `journey/design.md` so the documented API surface matches the runtime.
4. Run targeted formatting and browser tests for the website/demo and wrap behavior.
