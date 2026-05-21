import type { CSSProperties } from "vue";

// InlineClamp measures a single inline-block because affixes and middle
// truncation cannot be represented by native text-overflow.
export const inlineClampRootStyle: CSSProperties = {
  display: "inline-block",
  maxWidth: "100%",
  minWidth: "0",
  overflow: "hidden",
  position: "relative",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};
