import type { PropType } from "vue";
import type { ClampBoundary, LineClampLocation } from "./types.ts";

// Shared prop definitions keep runtime validators and defaults consistent across
// the components that expose the same public API concepts.
export const blockAsProp = {
  type: String,
  default: "div",
} as const;

export const boundaryProp = {
  type: String as PropType<ClampBoundary>,
  default: "grapheme",
  validator(value: unknown) {
    // Runtime validation mirrors the public union because invalid boundaries
    // change truncation semantics rather than only presentation.
    return value === "grapheme" || value === "word";
  },
} as const;

export const ellipsisProp = {
  type: String,
  default: "…",
} as const;

export const expandedProp = {
  type: Boolean,
  default: false,
} as const;

export const locationProp = {
  type: [String, Number] as PropType<LineClampLocation>,
  default: "end",
  validator(value: unknown) {
    // Numeric ratios are clamped later; accepting any finite number makes the
    // prop ergonomic while keeping non-numeric input out.
    return (
      value === "start" ||
      value === "middle" ||
      value === "end" ||
      (typeof value === "number" && Number.isFinite(value))
    );
  },
} as const;

export const maxHeightProp = [Number, String] as PropType<number | string | undefined>;

export const maxLinesProp = Number;
