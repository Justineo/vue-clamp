import type { PropType } from "vue";
import type { LineClampLocation } from "./types.ts";

export const blockAsProp = {
  type: String,
  default: "div",
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
