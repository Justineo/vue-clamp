# 044 Import Type Grouping

## Goal

Normalize the codebase so value imports/exports and type imports/exports are separated into distinct groups with a blank line between them.

## Plan

1. Inventory current files for mixed or interleaved value/type imports and exports.
2. Update each affected file so:
   - value imports come first
   - type imports come after a blank line
   - value exports come first
   - type exports come after a blank line
3. Run formatting and validation.
4. Record the result in `journey/logs/`.

## Constraints

- Keep behavior unchanged.
- Do not introduce broader refactors beyond import/export grouping.
- Follow existing sort/order conventions inside each value or type group.
