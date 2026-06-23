import { describe, expect, it } from "vite-plus/test";
import {
  createCoalescingRunner,
  hasInlineFontMetrics,
  hasUnresolvedInlineTextWidthStyle,
  hasUnresolvedStyleReference,
  isContentIndependentWidth,
} from "../src/layout.ts";

function fontMetricsStyle(font: string, fontFamily = "", fontSize = ""): CSSStyleDeclaration {
  return {
    font,
    fontFamily,
    fontSize,
  } as CSSStyleDeclaration;
}

function inlineStyle(values: Record<string, string>): CSSStyleDeclaration {
  return {
    getPropertyValue(property: string) {
      return values[property] ?? "";
    },
  } as CSSStyleDeclaration;
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await Promise.resolve();
  }
}

describe("layout style helpers", () => {
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

  it("requires direct inline font metrics before trusting exact result caches", () => {
    expect(hasInlineFontMetrics(fontMetricsStyle("16px Georgia, serif"))).toBe(true);
    expect(hasInlineFontMetrics(fontMetricsStyle("", "Georgia, serif", "16px"))).toBe(true);
    expect(hasInlineFontMetrics(fontMetricsStyle("", "Georgia, serif"))).toBe(false);
    expect(hasInlineFontMetrics(fontMetricsStyle("", "", "16px"))).toBe(false);
    expect(hasInlineFontMetrics(fontMetricsStyle("var(--inline-font)"))).toBe(false);
    expect(hasInlineFontMetrics(fontMetricsStyle("", "Georgia, serif", "var(--font-size)"))).toBe(
      false,
    );
    expect(hasInlineFontMetrics(fontMetricsStyle("", "var(--font-family)", "16px"))).toBe(false);
    expect(hasInlineFontMetrics(fontMetricsStyle(""))).toBe(false);
  });

  it("checks unresolved inline text width styles without rejecting unrelated styles", () => {
    expect(
      hasUnresolvedInlineTextWidthStyle(
        inlineStyle({
          color: "var(--theme-color)",
          "max-width": "100%",
          width: "180px",
        }),
      ),
    ).toBe(false);
    expect(
      hasUnresolvedInlineTextWidthStyle(
        inlineStyle({
          "font-size": "var(--font-size)",
        }),
      ),
    ).toBe(true);
    expect(
      hasUnresolvedInlineTextWidthStyle(
        inlineStyle({
          "letter-spacing": "var(--letter-spacing)",
        }),
      ),
    ).toBe(true);
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
