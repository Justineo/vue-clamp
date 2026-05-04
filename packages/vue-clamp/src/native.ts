import type { CSSProperties } from "vue";
import type { ClampBoundary } from "./types.ts";

export type NativeClampMode = "single-line" | "multi-line";

type NativeModeInput = {
  boundary: ClampBoundary;
  ellipsis: string;
  expanded: boolean;
  hasAfterSlot: boolean;
  lineLimit: number | undefined;
  locationRatio: number;
  maxHeight: number | string | undefined;
};

let supportsMultilineClamp: boolean | null = null;

export const nativeBodyStyle: CSSProperties = {
  display: "block",
  flex: "1 1 auto",
  minWidth: "0",
};

export const nativeTextStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  overflowWrap: "normal",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const nativeSingleLineContentStyle: CSSProperties = {
  alignItems: "baseline",
  display: "inline-flex",
  maxWidth: "100%",
  verticalAlign: "baseline",
  width: "100%",
};

function hasMultilineClamp(): boolean {
  if (supportsMultilineClamp !== null) {
    return supportsMultilineClamp;
  }

  supportsMultilineClamp =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    (CSS.supports("-webkit-line-clamp", "2") || CSS.supports("line-clamp", "2"));

  return supportsMultilineClamp;
}

export function resolveNativeMode({
  boundary,
  ellipsis,
  expanded,
  hasAfterSlot,
  lineLimit,
  locationRatio,
  maxHeight,
}: NativeModeInput): NativeClampMode | null {
  // Native CSS only matches end/grapheme/default-ellipsis text. Other props need
  // the measured path so the public API keeps the same semantics.
  if (
    expanded ||
    maxHeight !== undefined ||
    locationRatio !== 1 ||
    boundary !== "grapheme" ||
    ellipsis !== "…"
  ) {
    return null;
  }

  if (lineLimit === 1) {
    return "single-line";
  }

  // Multiline line-clamp cannot reserve suffix slot space. The single-line
  // text-overflow path can because slots are fixed flex siblings.
  if (lineLimit !== undefined && lineLimit > 1 && !hasAfterSlot && hasMultilineClamp()) {
    return "multi-line";
  }

  return null;
}

export function getNativeContentStyle(
  mode: NativeClampMode | null,
  lineLimit: number | undefined,
): CSSProperties | undefined {
  if (mode === "single-line") {
    return nativeSingleLineContentStyle;
  }

  if (mode !== "multi-line" || lineLimit === undefined) {
    return undefined;
  }

  return {
    display: "-webkit-box",
    lineClamp: String(lineLimit),
    maxWidth: "100%",
    overflow: "hidden",
    verticalAlign: "baseline",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: String(lineLimit),
  };
}

export function measureNativeClamped(element: HTMLElement, mode: NativeClampMode): boolean | null {
  if (element.clientWidth <= 0 || element.getBoundingClientRect().width <= 0) {
    return null;
  }

  if (mode === "multi-line") {
    return element.scrollHeight > element.clientHeight + 0.5;
  }

  return element.scrollWidth > element.clientWidth + 0.5;
}
