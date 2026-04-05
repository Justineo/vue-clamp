# 194 - iOS text autosize fix for demo startup

## Goal

Fix the iOS-only startup issue where demo text appears larger than expected.

## Plan

1. Validate likely iOS-specific cause in website styles/viewport handling (Safari text autosizing).
2. Add an explicit text-size-adjust baseline so typography stays stable from first paint.
3. Run formatting/checks and document the update.
