import { describe, expect, it } from "vite-plus/test";
import * as exports from "../src/index.ts";

describe("Public exports", () => {
  it("exports the documented root components", () => {
    expect(exports.LineClamp.name).toBe("LineClamp");
    expect(exports.InlineClamp.name).toBe("InlineClamp");
    expect(exports.WrapClamp.name).toBe("WrapClamp");
  });

  it("does not expose the old Clamp alias", () => {
    expect("Clamp" in exports).toBe(false);
  });
});
