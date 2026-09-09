import { expect, it } from "vite-plus/test";
import { textLayoutMetricKey } from "../src/layout.ts";

// Compare compact-key invalidation against the independently serialized CSS
// inputs, including settings that make a font shorthand unserializable.
const metricChanges = {
  font: "italic small-caps 700 condensed 18px/31px Georgia",
  "font-family": "Georgia, serif",
  "font-feature-settings": '"liga" 0',
  "font-kerning": "none",
  "font-optical-sizing": "none",
  "font-size": "24px",
  "font-size-adjust": "0.7",
  "font-stretch": "75%",
  "font-style": "italic",
  "font-synthesis": "none",
  "font-variant": "small-caps",
  "font-variation-settings": '"wdth" 75',
  "font-weight": "700",
  "letter-spacing": "2px",
  "text-transform": "uppercase",
  "word-spacing": "3px",
  "font-language-override": '"TRK"',
  "line-height": "31px",
  "text-indent": "6px",
  "tab-size": "4",
  "white-space": "pre-wrap",
  "line-break": "anywhere",
  "text-wrap-style": "balance",
  "text-autospace": "normal",
  "word-break": "break-all",
  "overflow-wrap": "anywhere",
  hyphens: "auto",
  direction: "rtl",
  "unicode-bidi": "bidi-override",
  "writing-mode": "vertical-rl",
  "text-orientation": "upright",
  "vertical-align": "super",
};

it("invalidates compact typography keys for changed computed metrics", () => {
  const element = document.createElement("span");
  element.textContent = "abc Í 世";
  document.body.append(element);
  const equivalents = new Map<string, string>();
  let sawShorthand = false;
  let sawFallback = false;

  function sample(context: string) {
    const style = getComputedStyle(element);
    const expanded = Object.keys(metricChanges)
      .map((property) => style.getPropertyValue(property))
      .join("\n");
    const compact = textLayoutMetricKey(style);
    const previous = equivalents.get(compact);
    if (previous !== undefined) {
      expect(expanded, `${context}: distinct metrics must not share a compact key`).toBe(previous);
    } else {
      equivalents.set(compact, expanded);
    }
    if (style.font.includes(" ")) sawShorthand = true;
    else sawFallback = true;
    return { expanded, compact };
  }

  try {
    for (const context of [
      "font:16px/24px Arial",
      "font:menu",
      "font:caption",
      'font:16px/24px Arial;font-feature-settings:"liga" 0',
      "font:16px/24px Arial;font-stretch:83%",
      'font:16px/24px Arial;font-variation-settings:"wdth" 90',
    ]) {
      for (const [property, value] of Object.entries(metricChanges)) {
        element.style.cssText = context;
        const before = sample(`${context}; before ${property}`);
        element.style.setProperty(property, value);
        const after = sample(`${context}; ${property}:${value}`);
        // Unsupported declarations and equivalent computed values do not need
        // invalidation; any observable metric difference does.
        if (before.expanded !== after.expanded) {
          expect(after.compact, `${property}:${value}`).not.toBe(before.compact);
        }
      }
    }
    expect(sawShorthand).toBe(true);
    expect(sawFallback).toBe(true);
  } finally {
    element.remove();
  }
});
