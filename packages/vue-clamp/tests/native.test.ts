import { describe, expect, it } from "vite-plus/test";
import { resolveNativeMode } from "../src/native.ts";

import type { NativeModeInput } from "../src/native.ts";

const input = {
  boundary: "grapheme",
  ellipsis: "…",
  expanded: false,
  hasAfterSlot: false,
  lineLimit: 2,
  locationRatio: 1,
  maxHeight: undefined,
} satisfies NativeModeInput;

describe("native clamp selection", () => {
  it("selects semantically eligible multiline clamps", () => {
    expect(resolveNativeMode(input)).toBe("multi-line");
  });

  it("keeps custom ellipses off the legacy native path", () => {
    expect(resolveNativeMode({ ...input, ellipsis: "..." })).toBeNull();
  });
});
