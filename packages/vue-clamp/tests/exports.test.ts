import { describe, expect, it } from "vite-plus/test";
import { Clamp, InlineClamp, LineClamp, WrapClamp } from "../src/index.ts";

describe("Public exports", () => {
  it("keeps Clamp as a compatibility alias of LineClamp", () => {
    expect(Clamp).toBe(LineClamp);
  });

  it("re-exports InlineClamp from the root entry", () => {
    expect(InlineClamp.name).toBe("InlineClamp");
  });

  it("re-exports WrapClamp from the root entry", () => {
    expect(WrapClamp.name).toBe("WrapClamp");
  });
});
