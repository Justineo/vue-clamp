import type { CSSProperties } from "vue";
import type { ClampBoundary, ClampLength } from "./types.ts";

export type NativeClampMode = "single-line" | "multi-line";

export type NativeModeInput = {
  readonly boundary: ClampBoundary;
  readonly ellipsis: string;
  readonly expanded: boolean;
  readonly hasAfterSlot: boolean;
  readonly lineLimit: number | undefined;
  readonly locationRatio: number;
  readonly maxHeight: ClampLength | undefined;
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
const nativeMultiLineContentStyles = new Map<number, CSSProperties>();

function getNativeMultiLineContentStyle(lineLimit: number): CSSProperties {
  const cached = nativeMultiLineContentStyles.get(lineLimit);
  if (cached) {
    return cached;
  }

  const lineClamp = String(lineLimit);
  const style: CSSProperties = {
    display: "-webkit-box",
    lineClamp,
    maxWidth: "100%",
    overflow: "hidden",
    verticalAlign: "baseline",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lineClamp,
  };
  nativeMultiLineContentStyles.set(lineLimit, style);

  return style;
}

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

  return getNativeMultiLineContentStyle(lineLimit);
}

export function measureNativeClamped(
  element: HTMLElement,
  mode: NativeClampMode,
  measurableWidth?: number,
): boolean | null {
  if (mode === "multi-line") {
    const clientWidth = element.clientWidth;
    if (clientWidth <= 0 || (measurableWidth !== undefined && measurableWidth <= 0)) {
      return null;
    }

    return element.scrollHeight > element.clientHeight + 0.5;
  }

  const clientWidth = element.clientWidth;
  if (clientWidth <= 0) {
    return null;
  }

  return element.scrollWidth > clientWidth + 0.5;
}
