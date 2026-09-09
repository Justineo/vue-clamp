import { expect, it } from "vite-plus/test";
import {
  borderBoxSizeSnapshot,
  emptyBorderBoxSignature,
  observedBorderBoxSizeSnapshot,
} from "../src/layout.ts";

function entryFor(element: HTMLElement, vertical = false): ResizeObserverEntry {
  return {
    target: element,
    borderBoxSize: [{ inlineSize: vertical ? 40 : 120.25, blockSize: vertical ? 120.25 : 40 }],
  } as unknown as ResizeObserverEntry;
}

function readWithCounts(element: HTMLElement, vertical = false) {
  const originalStyle = window.getComputedStyle;
  const originalBounds = element.getBoundingClientRect.bind(element);
  const styles = new Map<Element, number>();
  let bounds = 0;
  window.getComputedStyle = (target, pseudo) => {
    styles.set(target, (styles.get(target) ?? 0) + 1);
    return originalStyle.call(window, target, pseudo);
  };
  element.getBoundingClientRect = () => {
    bounds += 1;
    return originalBounds();
  };
  try {
    return {
      snapshot: observedBorderBoxSizeSnapshot(entryFor(element, vertical), emptyBorderBoxSignature),
      styles,
      bounds: () => bounds,
    };
  } finally {
    window.getComputedStyle = originalStyle;
    element.getBoundingClientRect = originalBounds;
  }
}

for (const mode of [
  "ordinary",
  "current-transform",
  "ancestor-transform",
  "ancestor-perspective",
  "vertical",
] as const) {
  it(`preserves ${mode} observer geometry while reading target style once`, () => {
    const parent = document.createElement("div");
    const element = document.createElement("div");
    element.style.cssText = "width:120.25px;height:40px;transform-origin:0 0";
    parent.style.transformOrigin = "0 0";
    parent.append(element);
    document.body.append(parent);
    try {
      if (mode === "current-transform") element.style.transform = "scale(0.5)";
      if (mode === "ancestor-transform") parent.style.transform = "scale(0.5)";
      if (mode === "ancestor-perspective") parent.style.perspective = "700px";
      if (mode === "vertical") element.style.writingMode = "vertical-rl";
      const result = readWithCounts(element, mode === "vertical");
      expect(result.snapshot).toEqual(borderBoxSizeSnapshot(element));
      expect(result.styles.get(element)).toBe(1);
      expect(result.bounds()).toBe(mode === "ordinary" ? 0 : 1);
      if (mode === "current-transform" || mode === "vertical") {
        expect(result.styles.has(parent)).toBe(false);
      } else {
        expect(result.styles.get(parent)).toBe(1);
      }
    } finally {
      parent.remove();
    }
  });
}

it("keeps later ancestor-transform changes live across separate observer reads", () => {
  const parent = document.createElement("div");
  const element = document.createElement("div");
  element.style.cssText = "width:120.25px;height:40px";
  parent.style.transformOrigin = "0 0";
  parent.append(element);
  document.body.append(parent);
  try {
    const ordinary = readWithCounts(element);
    expect(ordinary.snapshot?.width).toBe(120.25);
    expect(ordinary.bounds()).toBe(0);
    parent.style.transform = "scale(0.5)";
    const transformed = readWithCounts(element);
    expect(transformed.snapshot).toEqual(borderBoxSizeSnapshot(element));
    expect(Math.abs(transformed.snapshot!.width - ordinary.snapshot!.width / 2)).toBeLessThan(
      1 / 60,
    );
    expect(transformed.styles.get(element)).toBe(1);
    expect(transformed.styles.get(parent)).toBe(1);
    expect(transformed.bounds()).toBe(1);
  } finally {
    parent.remove();
  }
});
