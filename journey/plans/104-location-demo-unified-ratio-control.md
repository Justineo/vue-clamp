# 104 Location Demo Unified Ratio Control

## Goal

Make the website `location` demo use one unified control model:

- the ratio slider is always active
- the `start` / `middle` / `end` pills are quick presets
- when the ratio lands on `0`, `0.5`, or `1`, the matching pill is selected

## Changes

1. Remove the location helper note.
2. Remove the concept of a separate mode for location presets vs ratio.
3. Use one ratio value as the source of truth.
4. Derive alias pills from exact preset ratios.
5. Keep browser coverage aligned with the simplified interaction.

## Outcome Target

- The demo presents `location` aliases and numeric ratios as one control system.
- Users can move seamlessly between pills and the ratio slider without any mode switch.
