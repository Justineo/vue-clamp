import type { CSSProperties } from "vue";

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
