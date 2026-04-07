# Browser provider init-script cleanup

## Goal

Keep the ResizeObserver warning suppression, but move it out of the browser config files and onto a
cleaner provider-level extension point.

## Plan

1. Replace the inline `PlaywrightBrowserProvider` method patch in the browser config with a local
   provider helper.
2. Attach the warning filter through the provider's `initScripts` hook and a dedicated init-script
   module.
3. Re-run `vp check` and spot-check the test server wiring for the injected script.
