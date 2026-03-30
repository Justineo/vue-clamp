import { afterEach, describe, expect, it } from "vite-plus/test";
import { runPretextDomClamp } from "../benchmark/pretext-dom.ts";
import { sampleVisibleLineCounts } from "./browser.ts";
import type { BenchmarkClampInput, BenchmarkDomFixture } from "../benchmark/types.ts";

const ENGLISH_TEXT =
  "Vue is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable across layouts that change often.";

const mounted = new Set<HTMLElement>();

function fixture(width: number): BenchmarkDomFixture {
  const rootElement = document.createElement("div");
  rootElement.style.width = `${width}px`;
  rootElement.style.font = "16px Georgia, serif";
  rootElement.style.lineHeight = "24px";
  rootElement.style.overflow = "hidden";
  rootElement.style.whiteSpace = "normal";
  rootElement.style.overflowWrap = "break-word";

  const contentElement = document.createElement("span");
  const textElement = document.createElement("span");
  contentElement.append(textElement);
  rootElement.append(contentElement);
  document.body.append(rootElement);
  mounted.add(rootElement);

  return {
    rootElement,
    contentElement,
    textElement,
    beforeElement: null,
    afterElement: null,
  };
}

function input(width: number): BenchmarkClampInput {
  return {
    fixture: fixture(width),
    text: ENGLISH_TEXT,
    location: "end",
    ellipsis: "…",
    maxLines: 3,
  };
}

afterEach(() => {
  for (const rootElement of mounted) {
    rootElement.remove();
  }

  mounted.clear();
});

describe("Benchmark browser adapter", () => {
  it("keeps the pretext benchmark fixture within 3 visible lines at fractional widths", async () => {
    const currentInput = input(220.671875);
    runPretextDomClamp(currentInput);

    expect(currentInput.fixture.rootElement.getBoundingClientRect().width).toBeCloseTo(
      220.671875,
      3,
    );
    expect(await sampleVisibleLineCounts(currentInput.fixture.rootElement)).toEqual([3, 3, 3]);
  });
});
