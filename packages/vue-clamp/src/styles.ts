import type { CSSProperties } from "vue";

export const predictiveRootStyle: CSSProperties = { display: "block", overflow: "hidden" };
export const predictivePendingStyle: CSSProperties = { visibility: "hidden" };
export const predictiveWidthStyle: CSSProperties = {
  border: 0,
  display: "block",
  height: 0,
  margin: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: 0,
  visibility: "hidden",
  width: "100%",
};

// Keep source text available to assistive technology without letting it change
// the measured inline layout used for clamp decisions.
export const visuallyHiddenTextStyle: CSSProperties = {
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
};
