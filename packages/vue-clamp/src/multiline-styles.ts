import type { CSSProperties } from "vue";

// Slot wrappers are inline-flex so before/after controls participate in the same
// line box as text while staying atomic during measurement.
export const multilineSlotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

export const multilineNativeSlotStyle: CSSProperties = {
  ...multilineSlotStyle,
  flex: "none",
};
