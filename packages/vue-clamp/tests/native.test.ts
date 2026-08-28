import { describe, expect, it } from "vite-plus/test";
import { resolveNativeMode } from "../src/native.ts";

describe("native clamp selection", () => {
  it("selects the specified legacy multiline clamp without a runtime feature query", () => {
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
});
