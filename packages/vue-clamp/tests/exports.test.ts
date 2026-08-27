import { describe, expect, it, vi } from "vite-plus/test";
import * as exports from "../src/index.ts";

describe("Public exports", () => {
  it("exports the documented root components", () => {
    expect(exports.LineClamp.name).toBe("LineClamp");
    expect(exports.RichLineClamp.name).toBe("RichLineClamp");
    expect(exports.InlineClamp.name).toBe("InlineClamp");
    expect(exports.WrapClamp.name).toBe("WrapClamp");
  });

  it("does not expose the old Clamp alias", () => {
    expect("Clamp" in exports).toBe(false);
  });

  it("does not expose internal runtime helpers", () => {
    expect("borderBoxWidth" in exports).toBe(false);
    expect("clampTextToFit" in exports).toBe(false);
    expect("prepareRich" in exports).toBe(false);
  });
});

describe("Module evaluation", () => {
  it("does not construct a segmenter while loading the package", async () => {
    const construct = vi.fn();
    const NativeSegmenter = Intl.Segmenter;

    class TrackedSegmenter extends NativeSegmenter {
      constructor(...args: ConstructorParameters<typeof NativeSegmenter>) {
        construct();
        super(...args);
      }
    }

    Object.defineProperty(Intl, "Segmenter", { configurable: true, value: TrackedSegmenter });
    vi.resetModules();

    try {
      await import("../src/index.ts");
      expect(construct).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Intl, "Segmenter", { configurable: true, value: NativeSegmenter });
      vi.resetModules();
    }
  });
});
