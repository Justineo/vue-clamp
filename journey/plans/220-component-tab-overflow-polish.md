# Plan

## Goal

Polish the website component-tab overflow behavior on narrow widths.

## Steps

1. Remove the mobile scrollbar/separator artifact from the component tabs.
2. Hide the native scrollbar while keeping horizontal swipe/scroll behavior.
3. Add a lightweight overflow cue so users can tell more tabs exist, and ellipsize labels instead
   of letting them feel abruptly cut off.
4. Update browser coverage, then validate and refresh journey memory.

## Outcome

- Done on 2026-04-08.
- The component tabs now hide the native scrollbar, avoid the extra mobile separator artifact, and
  use ellipsis plus a small `More` cue to indicate off-screen tabs.
