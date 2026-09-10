import { describe, expect, it } from "vite-plus/test";
import {
  countLineBoxes,
  createCoalescingRunner,
  fitsContent,
  hasUnresolvedStyleReference,
  isContentIndependentWidth,
} from "../src/layout.ts";

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await Promise.resolve();
  }
}

describe("layout style helpers", () => {
  it("counts physical line boxes rather than inline fragments", () => {
    const rects = [
      { bottom: 20, height: 20, top: 0 },
      { bottom: 20.2, height: 18, top: 0.2 },
      { bottom: 40, height: 20, top: 20 },
      { bottom: 0, height: 0, top: 0 },
    ] as unknown as DOMRectList;

    expect(countLineBoxes(rects)).toBe(2);
  });

  it("preserves tolerant line grouping for overlapping and unordered fragments", () => {
    let seed = 329;
    for (let sample = 0; sample < 64; sample += 1) {
      const rects = Array.from({ length: 160 }, (_, index) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const top = (seed % 400) / 10 - 20;
        const height = index % 17 === 0 ? 0 : 18 + (seed % 3);
        return { top, bottom: top + height, height };
      });
      const representatives: typeof rects = [];
      for (const rect of rects) {
        if (
          rect.height > 0 &&
          !representatives.some(
            (line) =>
              Math.abs(line.top - rect.top) <= 0.5 && Math.abs(line.bottom - rect.bottom) <= 0.5,
          )
        )
          representatives.push(rect);
      }
      expect(countLineBoxes(rects as unknown as DOMRectList)).toBe(representatives.length);
      const root = {
        clientTop: 0,
        clientHeight: 35,
        getBoundingClientRect: () => ({ top: -20 }),
      } as unknown as HTMLElement;
      const content = {
        getClientRects: () => rects,
      } as unknown as HTMLElement;
      for (const limit of [1, 12, 80, 200]) {
        expect(fitsContent(root, content, limit, undefined)).toBe(representatives.length <= limit);
        expect(fitsContent(root, content, limit, 35)).toBe(
          representatives.length <= limit &&
            rects.every((rect) => rect.height <= 0 || (rect.top >= -20.5 && rect.bottom <= 15.5)),
        );
      }
    }
  });

  it("processes long ordered line lists without comparing every earlier line", () => {
    let reads = 0;
    const rects = Array.from({ length: 4000 }, (_, index) => ({
      get top() {
        reads += 1;
        return Math.floor(index / 2) * 20;
      },
      bottom: (Math.floor(index / 2) + 1) * 20,
      height: 20,
    }));
    expect(countLineBoxes(rects as unknown as DOMRectList)).toBe(2000);
    expect(reads).toBeLessThan(20000);

    reads = 0;
    const content = { getClientRects: () => rects } as unknown as HTMLElement;
    expect(fitsContent({} as HTMLElement, content, 2000, undefined)).toBe(true);
    expect(reads).toBeLessThan(20000);
  });

  it("detects unresolved width references", () => {
    expect(hasUnresolvedStyleReference("calc(100% - 8px)")).toBe(true);
    expect(hasUnresolvedStyleReference("var(--clamp-width)")).toBe(true);
    expect(hasUnresolvedStyleReference("VAR(--clamp-width)")).toBe(true);
    expect(hasUnresolvedStyleReference("12.5rem")).toBe(false);
  });

  it("accepts only content-independent inline widths", () => {
    expect(isContentIndependentWidth("120px")).toBe(true);
    expect(isContentIndependentWidth("12.5rem")).toBe(true);
    expect(isContentIndependentWidth("calc(10px + 2rem)")).toBe(true);
    expect(isContentIndependentWidth("clamp(12rem, 20vw, 24rem)")).toBe(true);
  });

  it("rejects content-dependent inline widths", () => {
    expect(isContentIndependentWidth("")).toBe(false);
    expect(isContentIndependentWidth("auto")).toBe(false);
    expect(isContentIndependentWidth("100%")).toBe(false);
    expect(isContentIndependentWidth("calc(100% - 8px)")).toBe(false);
    expect(isContentIndependentWidth("var(--clamp-width)")).toBe(false);
  });
});

describe("coalescing runner", () => {
  it("serializes coalesced requests made during a running task", async () => {
    let releaseFirstTask!: () => void;
    const firstTask = new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });
    const calls: number[] = [];
    let activeTasks = 0;
    let maxActiveTasks = 0;

    const runner = createCoalescingRunner(async () => {
      const call = calls.length + 1;
      calls.push(call);
      activeTasks += 1;
      maxActiveTasks = Math.max(maxActiveTasks, activeTasks);

      if (call === 1) {
        await firstTask;
      }

      activeTasks -= 1;
    });

    runner();
    await flushMicrotasks();

    expect(calls).toEqual([1]);

    runner();
    runner();
    await flushMicrotasks();

    expect(calls).toEqual([1]);

    releaseFirstTask();
    await flushMicrotasks();

    expect(calls).toEqual([1, 2]);
    expect(maxActiveTasks).toBe(1);
  });
});
