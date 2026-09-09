import { describe, expect, it } from "vite-plus/test";
import { simulateStaticFlow } from "../src/wrap/flow.ts";

function estimate(
  widths: readonly (number | null)[],
  options: {
    afterWidth?: number;
    beforeWidth?: number;
    lineLimit?: number;
  } = {},
) {
  return simulateStaticFlow({
    containerWidth: 100,
    itemCount: widths.length,
    itemWidth: (index) => widths[index] ?? null,
    lineLimit: 2,
    ...options,
  });
}

describe("static flow prefix with a fixed after box", () => {
  it("leaves room for the suffix on the final line", () => {
    // First line: 20 + 30 + 30. Second line: 30 + 30 + 35.
    expect(estimate([30, 30, 30, 30, 30, 30], { beforeWidth: 20, afterWidth: 35 })).toEqual({
      fitCount: 4,
      status: "overflow",
    });
  });

  it.each([null, 0, Number.NaN, -1, Number.POSITIVE_INFINITY])(
    "keeps the known fitting prefix before an unavailable item width %s",
    (width) => {
      expect(estimate([30, width, 30], { beforeWidth: 20, afterWidth: 35 })).toEqual({
        fitCount: 1,
        status: "unknown",
      });
    },
  );

  it("moves items after an oversized before box without losing the suffix budget", () => {
    expect(estimate([30, 30, 30], { beforeWidth: 120, afterWidth: 20 })).toEqual({
      fitCount: 2,
      status: "overflow",
    });
  });

  it("has no fitting modeled prefix when the suffix is wider than a line", () => {
    expect(estimate([20, 20], { afterWidth: 101 })).toEqual({
      fitCount: 0,
      status: "overflow",
    });
  });

  it("still checks before and after placement when there are no items", () => {
    expect(estimate([], { beforeWidth: 90, afterWidth: 20, lineLimit: 1 })).toEqual({
      fitCount: 0,
      status: "overflow",
    });
    expect(estimate([], { beforeWidth: 90, afterWidth: 20, lineLimit: 2 })).toEqual({
      fitCount: 0,
      status: "fit",
    });
  });

  it("retains the existing half-pixel line tolerance", () => {
    expect(estimate([40, 40, 19.5], { afterWidth: 20.5, lineLimit: 1 })).toEqual({
      fitCount: 2,
      status: "overflow",
    });
    expect(estimate([40, 40, 19.5], { afterWidth: 20.51, lineLimit: 1 })).toEqual({
      fitCount: 1,
      status: "overflow",
    });
  });

  it("keeps the item-only flow result when no after box is present", () => {
    expect(estimate([40, 40, 40], { lineLimit: 1 })).toEqual({
      fitCount: 2,
      status: "overflow",
    });
    expect(estimate([40, 40, 40])).toEqual({ fitCount: 3, status: "fit" });
  });
});
