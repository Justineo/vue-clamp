import { describe, expect, it } from "vite-plus/test";
import { resolveNativeMode } from "../src/native.ts";

describe("native clamp selection", () => {
  it("selects semantically eligible multiline clamps", () => {
    expect(
      resolveNativeMode({
        boundary: "grapheme",
        ellipsis: "…",
        expanded: false,
        hasAfterSlot: false,
        lineLimit: 2,
        locationRatio: 1,
        maxHeight: undefined,
      }),
    ).toBe("multi-line");
  });

  it("keeps custom ellipses off the legacy native path", () => {
    expect(
      resolveNativeMode({
        boundary: "grapheme",
        ellipsis: "...",
        expanded: false,
        hasAfterSlot: false,
        lineLimit: 2,
        locationRatio: 1,
        maxHeight: undefined,
      }),
    ).toBeNull();
  });
});
