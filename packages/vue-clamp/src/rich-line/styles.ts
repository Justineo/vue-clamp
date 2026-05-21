import type { CSSProperties } from "vue";

// Rich candidates are measured in an off-screen connected tree. Connected
// measurement preserves browser inline layout while keeping candidate churn out
// of the visible DOM.
export const richProbeStyle: CSSProperties = {
  display: "block",
  left: "-99999px",
  pointerEvents: "none",
  position: "absolute",
  top: "0",
  visibility: "hidden",
};
