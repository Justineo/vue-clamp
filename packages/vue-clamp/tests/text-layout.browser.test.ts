import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  emptyBorderBoxSignature,
  estimateLineCapacity,
  fitsContent,
  simpleLineFitFromStyle,
  visibleRootTop,
} from "../src/layout.ts";
import {
  estimateTargetRankInterval,
  estimateTargetRankLocalInterval,
  estimateWarmSearchProbeCount,
  estimateWarmSearchWidthRoom,
  warmSearchDecision,
} from "./search-model.ts";
import {
  clampTextToFit,
  clampTextToLayout,
  displayTextForKeptCount,
  prepareText,
} from "../src/text.ts";

import type { SimpleLineFit } from "../src/layout.ts";
import type { PreparedText, TextClampLayoutInput, TextClampResult } from "../src/text.ts";

type LayoutHost = {
  readonly container: HTMLElement;
  readonly content: HTMLElement;
  readonly root: HTMLElement;
  readonly text: HTMLElement;
  readonly width: number;
};

const mountedHosts = new Set<LayoutHost>();

function affixLayoutKey(before: string, after = emptyBorderBoxSignature): string {
  return `${before}|${after}`;
}

const noAffixLayoutKey = affixLayoutKey(emptyBorderBoxSignature);

function mountLayoutHost(width: number): LayoutHost {
  const container = document.createElement("div");
  document.body.append(container);

  const root = document.createElement("div");
  root.style.cssText = [
    `width:${width}px`,
    "display:block",
    "font:16px Georgia, serif",
    "line-height:20px",
    "overflow-wrap:break-word",
    "white-space:normal",
  ].join(";");

  const content = document.createElement("span");
  const body = document.createElement("span");
  const text = document.createElement("span");
  body.style.position = "relative";
  body.append(text);
  content.append(body);
  root.append(content);
  container.append(root);

  const host = {
    container,
    content,
    root,
    text,
    width,
  };
  mountedHosts.add(host);

  return host;
}

function textWritesDuring(target: HTMLElement, run: () => TextClampResult | null): string[] {
  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  const dataDescriptor = Object.getOwnPropertyDescriptor(CharacterData.prototype, "data");
  if (
    !textContentDescriptor?.get ||
    !textContentDescriptor.set ||
    !dataDescriptor?.get ||
    !dataDescriptor.set
  ) {
    throw new Error("Expected Node.textContent to be an accessor property.");
  }

  const writes: string[] = [];
  Object.defineProperty(Node.prototype, "textContent", {
    configurable: true,
    get() {
      return textContentDescriptor.get?.call(this);
    },
    set(value: string | null) {
      if (this === target) {
        writes.push(value ?? "");
      }

      textContentDescriptor.set?.call(this, value);
    },
  });
  Object.defineProperty(CharacterData.prototype, "data", {
    configurable: true,
    get() {
      return dataDescriptor.get?.call(this);
    },
    set(value: string) {
      if (this.parentNode === target) {
        writes.push(value);
      }

      dataDescriptor.set?.call(this, value);
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(Node.prototype, "textContent", textContentDescriptor);
    Object.defineProperty(CharacterData.prototype, "data", dataDescriptor);
  }

  return writes;
}

function countClientRectsDuring(element: Element, run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects");
  const original = descriptor?.value as ((this: Element) => DOMRectList) | undefined;
  if (!descriptor || !original) {
    throw new Error("Expected Element.prototype.getClientRects to be patchable.");
  }

  let calls = 0;
  Object.defineProperty(Element.prototype, "getClientRects", {
    ...descriptor,
    value(this: Element): DOMRectList {
      if (this === element) {
        calls += 1;
      }

      return original.call(this);
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(Element.prototype, "getClientRects", descriptor);
  }

  return calls;
}

type TextFitCostClass = "exact-rect-list" | "max-height-bounds" | "simple-height";

type FitCostSample = {
  readonly clientHeightReads: number;
  readonly clientRectEntries: number;
  readonly clientRectReads: number;
  readonly clientTopReads: number;
  readonly contentBoundingRectReads: number;
  readonly rootBoundingRectReads: number;
};

function elementNumberAccessor(
  element: Element,
  property: "clientHeight" | "clientTop",
): {
  descriptor: PropertyDescriptor & { get(this: Element): number };
  owner: object;
} {
  let owner: object | null = element;
  let descriptor: PropertyDescriptor | undefined;

  while (owner && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(owner, property);
    if (!descriptor) {
      owner = Object.getPrototypeOf(owner);
    }
  }

  if (!owner || !descriptor?.get) {
    throw new Error(`Expected ${property} to be an accessor property.`);
  }

  return {
    descriptor: descriptor as PropertyDescriptor & { get(this: Element): number },
    owner,
  };
}

function sampleFitCostDuring(root: HTMLElement, content: Element, run: () => void): FitCostSample {
  const boundingRectDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "getBoundingClientRect",
  );
  const getBoundingClientRect = boundingRectDescriptor?.value as
    | ((this: Element) => DOMRect)
    | undefined;
  const rectsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects");
  const getClientRects = rectsDescriptor?.value as ((this: Element) => DOMRectList) | undefined;
  if (!boundingRectDescriptor || !getBoundingClientRect || !rectsDescriptor || !getClientRects) {
    throw new Error("Expected layout probe methods to be patchable.");
  }

  const clientHeight = elementNumberAccessor(root, "clientHeight");
  const clientTop = elementNumberAccessor(root, "clientTop");
  const sample = {
    clientHeightReads: 0,
    clientRectEntries: 0,
    clientRectReads: 0,
    clientTopReads: 0,
    contentBoundingRectReads: 0,
    rootBoundingRectReads: 0,
  };

  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    ...boundingRectDescriptor,
    value(this: Element): DOMRect {
      if (this === content) {
        sample.contentBoundingRectReads += 1;
      } else if (this === root) {
        sample.rootBoundingRectReads += 1;
      }

      return getBoundingClientRect.call(this);
    },
  });
  Object.defineProperty(Element.prototype, "getClientRects", {
    ...rectsDescriptor,
    value(this: Element): DOMRectList {
      const result = getClientRects.call(this);

      if (this === content) {
        sample.clientRectReads += 1;
        sample.clientRectEntries += result.length;
      }

      return result;
    },
  });
  Object.defineProperty(clientHeight.owner, "clientHeight", {
    ...clientHeight.descriptor,
    get(this: Element): number {
      if (this === root) {
        sample.clientHeightReads += 1;
      }

      return clientHeight.descriptor.get.call(this);
    },
  });
  Object.defineProperty(clientTop.owner, "clientTop", {
    ...clientTop.descriptor,
    get(this: Element): number {
      if (this === root) {
        sample.clientTopReads += 1;
      }

      return clientTop.descriptor.get.call(this);
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(Element.prototype, "getBoundingClientRect", boundingRectDescriptor);
    Object.defineProperty(Element.prototype, "getClientRects", rectsDescriptor);
    Object.defineProperty(clientHeight.owner, "clientHeight", clientHeight.descriptor);
    Object.defineProperty(clientTop.owner, "clientTop", clientTop.descriptor);
  }

  return sample;
}

function predictTextFitCostClass(
  lineLimit: number | undefined,
  maxHeight: TextClampLayoutInput["maxHeight"],
  simpleLineFit?: SimpleLineFit,
): TextFitCostClass {
  if (lineLimit === undefined && maxHeight !== undefined) {
    return "max-height-bounds";
  }

  return maxHeight === undefined &&
    lineLimit !== undefined &&
    simpleLineFit?.maxLineBoxHeight !== undefined
    ? "simple-height"
    : "exact-rect-list";
}

function expectObservedTextFitCostClass(sample: FitCostSample, costClass: TextFitCostClass): void {
  if (costClass === "simple-height") {
    expect(sample.contentBoundingRectReads).toBeGreaterThan(0);
    expect(sample.clientRectReads).toBe(0);
    expect(sample.rootBoundingRectReads).toBe(0);
    expect(sample.clientHeightReads).toBe(0);
    expect(sample.clientTopReads).toBe(0);
    return;
  }

  if (costClass === "exact-rect-list") {
    expect(sample.clientRectReads).toBeGreaterThan(0);
    expect(sample.clientRectEntries).toBeGreaterThan(0);
    expect(sample.contentBoundingRectReads).toBe(0);
    expect(sample.rootBoundingRectReads).toBe(0);
    expect(sample.clientHeightReads).toBe(0);
    expect(sample.clientTopReads).toBe(0);
    return;
  }

  expect(sample.contentBoundingRectReads).toBeGreaterThan(0);
  expect(sample.rootBoundingRectReads).toBeGreaterThan(0);
  expect(sample.clientHeightReads).toBeGreaterThan(0);
  expect(sample.clientTopReads).toBeGreaterThan(0);
  expect(sample.clientRectReads).toBe(0);
}

type MutationSummary = {
  readonly characterData: number;
  readonly childList: number;
  readonly records: number;
};

function summarizeMutations(records: readonly MutationRecord[]): MutationSummary {
  return records.reduce<MutationSummary>(
    (summary, record) => ({
      characterData: summary.characterData + (record.type === "characterData" ? 1 : 0),
      childList: summary.childList + (record.type === "childList" ? 1 : 0),
      records: summary.records + 1,
    }),
    {
      characterData: 0,
      childList: 0,
      records: 0,
    },
  );
}

function collectTextProbeMutationsDuring(
  content: Element,
  target: Node,
  run: () => void,
): MutationSummary[] {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects");
  const original = descriptor?.value as ((this: Element) => DOMRectList) | undefined;
  if (!descriptor || !original) {
    throw new Error("Expected Element.prototype.getClientRects to be patchable.");
  }

  const observer = new MutationObserver(() => {});
  const samples: MutationSummary[] = [];

  observer.observe(target, {
    characterData: true,
    childList: true,
    subtree: true,
  });
  Object.defineProperty(Element.prototype, "getClientRects", {
    ...descriptor,
    value(this: Element): DOMRectList {
      const result = original.call(this);

      if (this === content) {
        samples.push(summarizeMutations(observer.takeRecords()));
      }

      return result;
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(Element.prototype, "getClientRects", descriptor);
    observer.disconnect();
  }

  return samples;
}

function countClientTopDuring(element: Element, run: () => void): number {
  const { descriptor, owner } = elementNumberAccessor(element, "clientTop");

  let calls = 0;
  Object.defineProperty(owner, "clientTop", {
    ...descriptor,
    get(this: Element): number {
      if (this === element) {
        calls += 1;
      }

      return descriptor.get!.call(this) as number;
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(owner, "clientTop", descriptor);
  }

  return calls;
}

function exactMaxHeightFits(root: HTMLElement, content: HTMLElement): boolean {
  const visibleTop = visibleRootTop(root);
  const visibleBottom = visibleTop + root.clientHeight;
  const rects = content.getClientRects();

  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    if (rect.height > 0 && (rect.top < visibleTop - 0.5 || rect.bottom > visibleBottom + 0.5)) {
      return false;
    }
  }

  return true;
}

type LayoutOverrides = Partial<
  Pick<
    TextClampLayoutInput,
    "ellipsis" | "layoutKey" | "lineCapacity" | "lineLimit" | "maxHeight" | "ratio"
  >
>;

function longWordText(): string {
  return Array.from({ length: 32 }, (_, index) => `observabilityPlatform${index + 1}`).join(" ");
}

function measuredTextWidth(text: string, style: string): number {
  const span = document.createElement("span");
  span.style.cssText = `${style};position:absolute;visibility:hidden;white-space:nowrap`;
  span.textContent = text;
  document.body.append(span);

  try {
    return span.getBoundingClientRect().width;
  } finally {
    span.remove();
  }
}

function averageUnitWidth(unit: string, style: string, count = 20): number {
  return measuredTextWidth(unit.repeat(count), style) / count;
}

function largestFittingKept(boundaryCount: number, fits: (kept: number) => boolean): number {
  let target = -1;

  for (let kept = 0; kept < boundaryCount; kept += 1) {
    if (fits(kept)) {
      target = kept;
    }
  }

  return target;
}

function fittingRankForLayout(
  host: LayoutHost,
  prepared: PreparedText,
  width: number,
  lineLimit: number | undefined,
  maxHeight?: TextClampLayoutInput["maxHeight"],
): number {
  const ellipsis = "…";
  const ratio = 1;
  host.root.style.width = `${width}px`;

  return largestFittingKept(prepared.boundaryOffsets.length - 1, (kept) => {
    host.text.textContent = displayTextForKeptCount(prepared, ratio, ellipsis, kept);

    return fitsContent(host.root, host.content, lineLimit, maxHeight, true);
  });
}

type CandidateAdvanceStats = {
  readonly max: number;
  readonly min: number;
};

function candidateAdvanceStats(
  prepared: PreparedText,
  style: string,
  ratio = 1,
  ellipsis = "…",
): CandidateAdvanceStats {
  let previous = measuredTextWidth(displayTextForKeptCount(prepared, ratio, ellipsis, 0), style);
  let minAdvance = Number.POSITIVE_INFINITY;
  let maxAdvance = 0;

  for (let kept = 1; kept < prepared.boundaryOffsets.length; kept += 1) {
    const width = measuredTextWidth(
      displayTextForKeptCount(prepared, ratio, ellipsis, kept),
      style,
    );
    const advance = width - previous;
    if (advance > 0.5) {
      minAdvance = Math.min(minAdvance, advance);
      maxAdvance = Math.max(maxAdvance, advance);
    }
    previous = width;
  }

  return {
    max: maxAdvance,
    min: minAdvance,
  };
}

function candidateSearchAdvances(
  prepared: PreparedText,
  style: string,
  ratio = 1,
  ellipsis = "…",
): number[] {
  const rankCount = prepared.boundaryOffsets.length - 1;
  const advances: number[] = [];
  let previous = measuredTextWidth(displayTextForKeptCount(prepared, ratio, ellipsis, 0), style);

  for (let kept = 1; kept < rankCount; kept += 1) {
    const width = measuredTextWidth(
      displayTextForKeptCount(prepared, ratio, ellipsis, kept),
      style,
    );
    advances.push(width - previous);
    previous = width;
  }

  return advances;
}

function advanceStats(advances: readonly number[]): CandidateAdvanceStats {
  let max = 0;
  let min = Number.POSITIVE_INFINITY;

  for (const advance of advances) {
    if (advance > 0.5) {
      max = Math.max(max, advance);
      min = Math.min(min, advance);
    }
  }

  if (!Number.isFinite(min) || min <= 0 || max <= 0) {
    throw new Error("Expected positive candidate advances.");
  }

  return { max, min };
}

function estimateTextRankInterval(
  prepared: PreparedText,
  style: string,
  previousRank: number,
  previousWidth: number,
  nextWidth: number,
  lineCapacity: number,
): ReturnType<typeof estimateTargetRankInterval> {
  return estimateTargetRankInterval({
    advance: candidateAdvanceStats(prepared, style),
    lineCapacity,
    nextWidth,
    previousRank,
    previousWidth,
    rankCount: prepared.boundaryOffsets.length - 1,
  });
}

async function expectStaleHintIgnored(
  stale: Partial<TextClampResult>,
  current: LayoutOverrides,
  checkResult: (result: TextClampResult | null) => void,
): Promise<void> {
  await document.fonts?.ready;

  const prepared = prepareText(longWordText(), "word");
  const host = mountLayoutHost(220);
  const layout = {
    ellipsis: "…",
    layoutKey: noAffixLayoutKey,
    lineCapacity: 3,
    lineLimit: 3,
    maxHeight: undefined,
    ratio: 1,
    ...current,
  } satisfies Required<LayoutOverrides>;
  const staleHint: TextClampResult = {
    boundaryOffsets: prepared.boundaryOffsets,
    ellipsis: "…",
    kept: 0,
    layoutKey: noAffixLayoutKey,
    lineCapacity: 3,
    lineLimit: 3,
    maxHeight: undefined,
    rankPerPx: 0.25,
    rankPerPxWidth: 40,
    ratio: 1,
    rootWidth: host.width,
    spacing: "trim",
    text: "…",
    ...stale,
  };

  const state: { result: TextClampResult | null } = { result: null };
  const writes = textWritesDuring(host.text, () => {
    state.result = clampTextToLayout({
      content: host.content,
      ellipsis: layout.ellipsis,
      hint: staleHint,
      lineCapacity: layout.lineCapacity,
      layoutKey: layout.layoutKey,
      lineLimit: layout.lineLimit,
      maxHeight: layout.maxHeight,
      prepared,
      ratio: layout.ratio,
      root: host.root,
      rootWidth: host.width,
      target: host.text,
    });

    return state.result;
  });
  const firstCandidate = writes.find((text) => text !== prepared.text);

  expect(firstCandidate).not.toBe(layout.ellipsis);
  checkResult(state.result);
}

afterEach(() => {
  for (const host of mountedHosts) {
    host.container.remove();
  }

  mountedHosts.clear();
});

describe("text layout helpers", () => {
  it("calibrates text line boxes before using simple-height fits", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(longWordText(), "word");
    const host = mountLayoutHost(240);
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    if (!simpleLineFit) {
      throw new Error("Expected roomy text metrics to expose a simple line fit.");
    }

    const calls = countClientRectsDuring(host.content, () => {
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        simpleLineFit,
        target: host.text,
      });
    });
    const secondCalls = countClientRectsDuring(host.content, () => {
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        simpleLineFit,
        target: host.text,
      });
    });

    expect(simpleLineFit.lineHeight).toBe(20);
    expect(calls).toBeGreaterThan(0);
    expect(simpleLineFit.maxLineBoxHeight).toBeGreaterThan(0);
    expect(secondCalls).toBe(0);
  });

  it("keeps exact text rect-list counting when font boxes can exceed line height", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(longWordText(), "word");
    const host = mountLayoutHost(240);
    host.root.style.fontSize = "18px";
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    expect(simpleLineFit?.lineHeight).toBe(20);
    expect(simpleLineFit?.maxLineBoxHeight).toBeUndefined();
    if (!simpleLineFit) {
      throw new Error("Expected tight text metrics to expose a simple line fit.");
    }

    const calls = countClientRectsDuring(host.content, () => {
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        simpleLineFit,
        target: host.text,
      });
    });

    expect(calls).toBeGreaterThan(0);
    expect(simpleLineFit?.maxLineBoxHeight).toBeGreaterThan(0);
  });

  it("calibrates tight text line boxes after the first exact line count", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(longWordText(), "word");
    const host = mountLayoutHost(240);
    host.root.style.fontSize = "18px";
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    if (!simpleLineFit) {
      throw new Error("Expected tight text metrics to expose a simple line fit.");
    }

    const firstCalls = countClientRectsDuring(host.content, () => {
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        simpleLineFit,
        target: host.text,
      });
    });
    const secondCalls = countClientRectsDuring(host.content, () => {
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        simpleLineFit,
        target: host.text,
      });
    });

    expect(firstCalls).toBeGreaterThan(0);
    expect(simpleLineFit.maxLineBoxHeight).toBeGreaterThan(0);
    expect(secondCalls).toBe(0);
  });

  it("matches declared text fit classes to observed layout reads", async () => {
    await document.fonts?.ready;

    const simpleHost = mountLayoutHost(180);
    simpleHost.text.textContent = "Release dashboards keep response ownership visible";
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(simpleHost.text));
    if (!simpleLineFit) {
      throw new Error("Expected roomy text metrics to expose a simple line fit.");
    }
    expect(predictTextFitCostClass(3, undefined, simpleLineFit)).toBe("exact-rect-list");
    expectObservedTextFitCostClass(
      sampleFitCostDuring(simpleHost.root, simpleHost.content, () => {
        fitsContent(
          simpleHost.root,
          simpleHost.content,
          3,
          undefined,
          true,
          undefined,
          simpleLineFit,
        );
      }),
      "exact-rect-list",
    );
    expect(simpleLineFit.maxLineBoxHeight).toBeGreaterThan(0);
    expect(predictTextFitCostClass(3, undefined, simpleLineFit)).toBe("simple-height");
    expectObservedTextFitCostClass(
      sampleFitCostDuring(simpleHost.root, simpleHost.content, () => {
        fitsContent(
          simpleHost.root,
          simpleHost.content,
          3,
          undefined,
          true,
          undefined,
          simpleLineFit,
        );
      }),
      "simple-height",
    );

    const exactHost = mountLayoutHost(140);
    exactHost.text.textContent = "Release dashboards keep response ownership visible";
    expect(predictTextFitCostClass(2, undefined)).toBe("exact-rect-list");
    expectObservedTextFitCostClass(
      sampleFitCostDuring(exactHost.root, exactHost.content, () => {
        fitsContent(exactHost.root, exactHost.content, 2, undefined, true);
      }),
      "exact-rect-list",
    );

    const maxHeightHost = mountLayoutHost(140);
    maxHeightHost.root.style.maxHeight = "40px";
    maxHeightHost.root.style.overflow = "hidden";
    maxHeightHost.text.textContent = "Release dashboards keep response ownership visible";
    expect(predictTextFitCostClass(undefined, "40px")).toBe("max-height-bounds");
    expectObservedTextFitCostClass(
      sampleFitCostDuring(maxHeightHost.root, maxHeightHost.content, () => {
        fitsContent(maxHeightHost.root, maxHeightHost.content, undefined, "40px");
      }),
      "max-height-bounds",
    );
  });

  it("reports content bounds from an existing simple-height fit read", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(180);
    host.text.textContent = "Release dashboards keep response ownership visible";
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    const bounds: DOMRect[] = [];

    if (!simpleLineFit) {
      throw new Error("Expected roomy text metrics to expose a simple line fit.");
    }

    fitsContent(host.root, host.content, 3, undefined, true, undefined, simpleLineFit);

    const sample = sampleFitCostDuring(host.root, host.content, () => {
      expect(
        fitsContent(
          host.root,
          host.content,
          3,
          undefined,
          true,
          undefined,
          simpleLineFit,
          (probe) => {
            if (probe.bounds) {
              bounds.push(probe.bounds);
            }
          },
        ),
      ).toBe(true);
    });
    const firstBounds = bounds[0];

    expect(firstBounds?.width).toBeGreaterThan(0);
    expect(firstBounds?.height).toBeGreaterThan(0);
    expect(sample.contentBoundingRectReads).toBe(1);
    expect(sample.clientRectReads).toBe(0);
  });

  it("matches the warm probe model against browser line-fit probes", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(longWordText(), "word");
    const host = mountLayoutHost(240);
    const boundaryCount = prepared.boundaryOffsets.length - 1;
    const ellipsis = "…";
    const lineLimit = 3;
    const ratio = 1;

    function fitsKept(kept: number): boolean {
      host.text.textContent = displayTextForKeptCount(prepared, ratio, ellipsis, kept);

      return fitsContent(host.root, host.content, lineLimit, undefined, true);
    }

    const target = largestFittingKept(boundaryCount, fitsKept);
    const hintKept = Math.max(0, target - 1);
    let probes = 0;

    expect(target).toBeGreaterThan(0);
    expect(target).toBeLessThan(boundaryCount - 1);

    const clientRectReads = countClientRectsDuring(host.content, () => {
      clampTextToFit({
        ellipsis,
        fits(candidate) {
          probes += 1;
          host.text.textContent = candidate;

          return fitsContent(host.root, host.content, lineLimit, undefined, true);
        },
        hint: {
          boundaryOffsets: prepared.boundaryOffsets,
          ellipsis,
          kept: hintKept,
          ratio,
          spacing: "trim",
        },
        prepared,
        ratio,
        spacing: "trim",
      });
    });

    expect(probes).toBe(estimateWarmSearchProbeCount(boundaryCount, hintKept, target));
    expect(clientRectReads).toBe(probes);
  });

  it("uses the failed full line count to seed a cold text search", async () => {
    await document.fonts?.ready;

    const prepared = prepareText("observability-platform ".repeat(32));
    const host = mountLayoutHost(180);
    const state: { result: TextClampResult | null } = { result: null };
    const reads = countClientRectsDuring(host.content, () => {
      state.result = clampTextToLayout({
        content: host.content,
        ellipsis: "...",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      });
    });

    expect(state.result?.text).not.toBe(prepared.text);
    expect(reads).toBeLessThanOrEqual(3);
  });

  it("seeds the grapheme fallback for a cold single-word text search", async () => {
    await document.fonts?.ready;

    const prepared = prepareText("observabilityPlatform".repeat(48), "word");
    const host = mountLayoutHost(180);
    const state: { result: TextClampResult | null } = { result: null };
    const reads = countClientRectsDuring(host.content, () => {
      state.result = clampTextToLayout({
        content: host.content,
        ellipsis: "...",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      });
    });

    expect(state.result?.text).not.toBe(prepared.text);
    expect(reads).toBeLessThanOrEqual(6);
  });

  it("uses the failed full bounds to seed a cold max-height search", async () => {
    await document.fonts?.ready;

    const prepared = prepareText("observability platform ".repeat(32));
    const host = mountLayoutHost(180);
    host.root.style.maxHeight = "60px";
    host.root.style.overflow = "hidden";
    const state: { result: TextClampResult | null } = { result: null };
    const sample = sampleFitCostDuring(host.root, host.content, () => {
      state.result = clampTextToLayout({
        content: host.content,
        ellipsis: "...",
        lineCapacity: 3,
        lineLimit: undefined,
        maxHeight: "60px",
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      });
    });

    expect(state.result?.text).not.toBe(prepared.text);
    expect(sample.contentBoundingRectReads).toBeLessThanOrEqual(3);
  });

  it("captures text probe mutations during actual layout fitting", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(longWordText(), "word");
    const host = mountLayoutHost(180);
    const state: { result: TextClampResult | null } = { result: null };
    const samples = collectTextProbeMutationsDuring(host.content, host.text, () => {
      state.result = clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        lineCapacity: 3,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      });
    });

    expect(state.result?.text).not.toBe(prepared.text);
    expect(samples.length).toBeGreaterThan(1);
    expect(samples.some((sample) => sample.childList > 0)).toBe(true);
    expect(samples.some((sample) => sample.characterData > 0 && sample.childList === 0)).toBe(true);
  });

  it("observes line count as a target-rank slope input", async () => {
    await document.fonts?.ready;

    const text = Array.from({ length: 60 }, (_, index) => `word${index + 1}`).join(" ");
    const prepared = prepareText(text, "word");
    const host = mountLayoutHost(160);
    const boundaryCount = prepared.boundaryOffsets.length - 1;

    const oneLineNarrow = fittingRankForLayout(host, prepared, 160, 1);
    const oneLineWide = fittingRankForLayout(host, prepared, 240, 1);
    const threeLineNarrow = fittingRankForLayout(host, prepared, 160, 3);
    const threeLineWide = fittingRankForLayout(host, prepared, 240, 3);
    const oneLineMove = oneLineWide - oneLineNarrow;
    const threeLineMove = threeLineWide - threeLineNarrow;

    expect(oneLineNarrow).toBeGreaterThan(0);
    expect(oneLineWide).toBeLessThan(boundaryCount - 1);
    expect(threeLineNarrow).toBeGreaterThan(oneLineNarrow);
    expect(threeLineWide).toBeLessThan(boundaryCount - 1);
    expect(threeLineMove).toBeGreaterThan(oneLineMove);
  });

  it("observes boundary density as a target-rank slope input", async () => {
    await document.fonts?.ready;

    const densePrepared = prepareText(
      Array.from({ length: 80 }, (_, index) => `w${index + 1}`).join(" "),
      "word",
    );
    const longPrepared = prepareText(
      Array.from({ length: 24 }, (_, index) => `observabilityPlatform${index + 1}`).join(" "),
      "word",
    );
    const host = mountLayoutHost(160);

    const denseMove =
      fittingRankForLayout(host, densePrepared, 240, 3) -
      fittingRankForLayout(host, densePrepared, 160, 3);
    const longMove =
      fittingRankForLayout(host, longPrepared, 240, 3) -
      fittingRankForLayout(host, longPrepared, 160, 3);

    expect(denseMove).toBeGreaterThan(0);
    expect(longMove).toBeGreaterThanOrEqual(0);
    expect(denseMove).toBeGreaterThan(longMove);
  });

  it("bounds target-rank growth from visible capacity and candidate density", async () => {
    await document.fonts?.ready;

    const style = "font:16px Georgia, serif;line-height:20px";
    const densePrepared = prepareText(
      Array.from({ length: 80 }, (_, index) => `w${index + 1}`).join(" "),
      "word",
    );
    const longPrepared = prepareText(
      Array.from({ length: 24 }, (_, index) => `observabilityPlatform${index + 1}`).join(" "),
      "word",
    );
    const host = mountLayoutHost(160);
    const lineCapacity = 3;
    const previousWidth = 160;
    const nextWidth = 240;

    const denseNarrow = fittingRankForLayout(host, densePrepared, previousWidth, lineCapacity);
    const denseWide = fittingRankForLayout(host, densePrepared, nextWidth, lineCapacity);
    const longNarrow = fittingRankForLayout(host, longPrepared, previousWidth, lineCapacity);
    const longWide = fittingRankForLayout(host, longPrepared, nextWidth, lineCapacity);
    const denseInterval = estimateTextRankInterval(
      densePrepared,
      style,
      denseNarrow,
      previousWidth,
      nextWidth,
      lineCapacity,
    );
    const longInterval = estimateTextRankInterval(
      longPrepared,
      style,
      longNarrow,
      previousWidth,
      nextWidth,
      lineCapacity,
    );

    expect(denseWide).toBeGreaterThanOrEqual(denseNarrow);
    expect(longWide).toBeGreaterThanOrEqual(longNarrow);
    expect(denseWide).toBeLessThanOrEqual(denseInterval.max);
    expect(longWide).toBeLessThanOrEqual(longInterval.max);
    expect(denseInterval.max - denseNarrow).toBeGreaterThan(longInterval.max - longNarrow);
  });

  it("does not bound text shrink from candidate density alone", async () => {
    await document.fonts?.ready;

    const style = "font:16px Georgia, serif;line-height:20px";
    const densePrepared = prepareText(
      Array.from({ length: 80 }, (_, index) => `w${index + 1}`).join(" "),
      "word",
    );
    const longPrepared = prepareText(
      Array.from({ length: 24 }, (_, index) => `observabilityPlatform${index + 1}`).join(" "),
      "word",
    );
    const host = mountLayoutHost(240);
    const lineCapacity = 3;
    const previousWidth = 240;
    const nextWidth = 160;

    const denseWide = fittingRankForLayout(host, densePrepared, previousWidth, lineCapacity);
    const denseNarrow = fittingRankForLayout(host, densePrepared, nextWidth, lineCapacity);
    const longWide = fittingRankForLayout(host, longPrepared, previousWidth, lineCapacity);
    const longNarrow = fittingRankForLayout(host, longPrepared, nextWidth, lineCapacity);
    const denseInterval = estimateTextRankInterval(
      densePrepared,
      style,
      denseWide,
      previousWidth,
      nextWidth,
      lineCapacity,
    );
    const longInterval = estimateTextRankInterval(
      longPrepared,
      style,
      longWide,
      previousWidth,
      nextWidth,
      lineCapacity,
    );

    expect(denseNarrow).toBeLessThanOrEqual(denseWide);
    expect(longNarrow).toBeLessThanOrEqual(longWide);
    expect(denseNarrow).toBeLessThan(denseInterval.min);
    expect(longInterval.min).toBeLessThanOrEqual(longWide);
  });

  it("bounds target-rank movement across held-out combined layouts", async () => {
    await document.fonts?.ready;

    const style = "font:16px Georgia, serif;line-height:20px";
    const cases = [
      {
        affix: true,
        boundary: "grapheme",
        from: 170,
        lineLimit: 2,
        text: "界".repeat(140),
        to: 230,
      },
      {
        affix: true,
        boundary: "grapheme",
        from: 260,
        maxHeight: "60px",
        text: "🙂".repeat(140),
        to: 180,
      },
      {
        boundary: "word",
        from: 140,
        lineLimit: 4,
        text: Array.from({ length: 90 }, (_, index) => `x${index + 1}`).join(" "),
        to: 210,
      },
    ] as const;

    for (const item of cases) {
      const prepared = prepareText(item.text, item.boundary);
      const host = mountLayoutHost(item.from);
      const lineLimit = "lineLimit" in item ? item.lineLimit : undefined;
      const maxHeight = "maxHeight" in item ? item.maxHeight : undefined;
      const lineCapacity = estimateLineCapacity(host.text, maxHeight, lineLimit);
      if (lineCapacity === undefined) {
        throw new Error("Expected a finite visible line capacity.");
      }

      if ("affix" in item && item.affix) {
        const before = document.createElement("span");
        const after = document.createElement("span");
        before.style.cssText = "display:inline-block;width:42px;height:16px";
        after.style.cssText = "display:inline-block;width:34px;height:16px";
        host.content.prepend(before);
        host.content.append(after);
      }

      if (maxHeight !== undefined) {
        host.root.style.overflow = "hidden";
        host.root.style.maxHeight = maxHeight;
      }

      const fromRank = fittingRankForLayout(host, prepared, item.from, lineLimit, maxHeight);
      const toRank = fittingRankForLayout(host, prepared, item.to, lineLimit, maxHeight);
      const interval =
        item.to > item.from
          ? estimateTextRankInterval(prepared, style, fromRank, item.from, item.to, lineCapacity)
          : null;

      expect(fromRank).toBeGreaterThan(0);
      expect(toRank).toBeGreaterThan(0);

      if (item.to > item.from) {
        expect(toRank).toBeGreaterThanOrEqual(fromRank);
        expect(toRank).toBeLessThanOrEqual(interval!.max);
      } else {
        expect(toRank).toBeLessThanOrEqual(fromRank);
      }
    }
  });

  it("does not treat text candidate widths as a complete line-break model", async () => {
    await document.fonts?.ready;

    const style = "font:16px Georgia, serif;line-height:20px";
    const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda";
    const prepared = prepareText(text, "word");
    const host = mountLayoutHost(150);
    const previousWidth = 150;
    const lineCapacity = 1;
    const previousRank = fittingRankForLayout(host, prepared, previousWidth, lineCapacity);
    const advances = candidateSearchAdvances(prepared, style);
    const advance = advanceStats(advances);
    const previousCandidate = displayTextForKeptCount(prepared, 1, "…", previousRank);
    const packingSlack = Math.max(0, previousWidth - measuredTextWidth(previousCandidate, style));
    const room = estimateWarmSearchWidthRoom({
      advances,
      count: prepared.boundaryOffsets.length - 1,
      hint: previousRank,
      lineCapacity,
      packingSlack,
    });
    const insideWidth = previousWidth + room.widthDeltaLimit - 0.001;
    const insideRank = fittingRankForLayout(host, prepared, insideWidth, lineCapacity);
    const insideInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity,
      nextWidth: insideWidth,
      packingSlack,
      previousRank,
      previousWidth,
      rankCount: prepared.boundaryOffsets.length - 1,
    });

    expect(room.useWarm).toBe(true);
    expect(room.widthDeltaLimit).toBeGreaterThan(0);
    expect(insideInterval.max).toBe(previousRank + room.maxRankMove);
    expect(insideRank).toBeGreaterThan(insideInterval.max);
    expect(
      warmSearchDecision({
        count: prepared.boundaryOffsets.length - 1,
        hint: previousRank,
        interval: insideInterval,
      }).useWarm,
    ).toBe(true);
  });

  it("observes CJK and emoji grapheme width as a target-rank slope input", async () => {
    await document.fonts?.ready;

    const style = "font:16px Georgia, serif;line-height:20px";
    const cjk = { unit: "界", width: averageUnitWidth("界", style) };
    const emoji = { unit: "🙂", width: averageUnitWidth("🙂", style) };
    const [narrow, wide] = cjk.width <= emoji.width ? [cjk, emoji] : [emoji, cjk];
    const narrowPrepared = prepareText(narrow.unit.repeat(120), "grapheme");
    const widePrepared = prepareText(wide.unit.repeat(120), "grapheme");
    const host = mountLayoutHost(160);

    const narrowMove =
      fittingRankForLayout(host, narrowPrepared, 240, 3) -
      fittingRankForLayout(host, narrowPrepared, 160, 3);
    const wideMove =
      fittingRankForLayout(host, widePrepared, 240, 3) -
      fittingRankForLayout(host, widePrepared, 160, 3);

    expect(Math.abs(cjk.width - emoji.width)).toBeGreaterThan(1);
    expect(narrowMove).toBeGreaterThan(0);
    expect(wideMove).toBeGreaterThan(0);
    expect(narrowMove).toBeGreaterThan(wideMove);
  });

  it("observes affix occupancy as a target-rank input", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(
      Array.from({ length: 60 }, (_, index) => `word${index + 1}`).join(" "),
      "word",
    );
    const host = mountLayoutHost(240);
    const noAffixRank = fittingRankForLayout(host, prepared, 240, 3);
    const before = document.createElement("span");
    const after = document.createElement("span");
    before.style.cssText = "display:inline-block;width:56px;height:16px";
    after.style.cssText = "display:inline-block;width:48px;height:16px";
    host.content.prepend(before);
    host.content.append(after);
    const affixRank = fittingRankForLayout(host, prepared, 240, 3);

    expect(noAffixRank).toBeGreaterThan(0);
    expect(affixRank).toBeGreaterThan(0);
    expect(affixRank).toBeLessThan(noAffixRank);
  });

  it("observes max height as a target-rank input", async () => {
    await document.fonts?.ready;

    const prepared = prepareText(
      Array.from({ length: 60 }, (_, index) => `word${index + 1}`).join(" "),
      "word",
    );
    const host = mountLayoutHost(200);
    host.root.style.overflow = "hidden";
    host.root.style.maxHeight = "40px";
    const fortyPxRank = fittingRankForLayout(host, prepared, 200, undefined, "40px");
    host.root.style.maxHeight = "60px";
    const sixtyPxRank = fittingRankForLayout(host, prepared, 200, undefined, "60px");

    expect(fortyPxRank).toBeGreaterThan(0);
    expect(sixtyPxRank).toBeGreaterThan(fortyPxRank);
  });

  it("keeps calibrated tight line boxes equivalent to exact line counting", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(120);
    host.root.style.fontSize = "18px";
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    if (!simpleLineFit) {
      throw new Error("Expected tight text metrics to expose a simple line fit.");
    }

    host.text.textContent = "Telemetry observability";
    expect(fitsContent(host.root, host.content, 2, undefined, true, undefined, simpleLineFit)).toBe(
      true,
    );

    host.text.textContent = "Telemetry 🙂 国际响应 observability";
    const exactTwoLines = fitsContent(host.root, host.content, 2, undefined, true);
    const fastTwoLines = fitsContent(
      host.root,
      host.content,
      2,
      undefined,
      true,
      undefined,
      simpleLineFit,
    );
    const exactThreeLines = fitsContent(host.root, host.content, 3, undefined, true);
    const fastThreeLines = fitsContent(
      host.root,
      host.content,
      3,
      undefined,
      true,
      undefined,
      simpleLineFit,
    );

    expect(fastTwoLines).toBe(exactTwoLines);
    expect(fastThreeLines).toBe(exactThreeLines);
  });

  it("calibrates line boxes before accepting an exact-limit RTL fit", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(420);
    host.root.style.direction = "rtl";
    host.root.style.textAlign = "start";
    host.text.textContent =
      "فرق الاستجابة تراجع incident 4721 و API latency وتبقي ownership واضحا أثناء تغيّر العرض. #1";
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    if (!simpleLineFit) {
      throw new Error("Expected text metrics to expose a simple line fit.");
    }

    const exactFit = fitsContent(host.root, host.content, 3, undefined, true);
    const calibratedFit = fitsContent(
      host.root,
      host.content,
      3,
      undefined,
      true,
      undefined,
      simpleLineFit,
    );
    const fastSample = sampleFitCostDuring(host.root, host.content, () => {
      expect(
        fitsContent(host.root, host.content, 3, undefined, true, undefined, simpleLineFit),
      ).toBe(true);
    });

    expect(exactFit).toBe(true);
    expect(calibratedFit).toBe(true);
    expect(simpleLineFit.maxLineBoxHeight).toBeGreaterThan(0);
    expectObservedTextFitCostClass(fastSample, "simple-height");
  });

  it("keeps calibrated affix line boxes equivalent to exact line counting", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(170);
    const before = document.createElement("strong");
    before.textContent = "SLO";
    before.style.marginRight = "4px";
    const after = document.createElement("button");
    after.textContent = "more";
    after.style.cssText = "font:inherit;margin-left:4px;padding:0;border:0;background:transparent";
    host.content.prepend(before);
    host.content.append(after);
    const simpleLineFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    if (!simpleLineFit) {
      throw new Error("Expected text metrics to expose a simple line fit.");
    }
    const affixLineFit: SimpleLineFit = { lineHeight: simpleLineFit.lineHeight };

    host.text.textContent = "Release dashboards keep response ownership visible";
    fitsContent(host.root, host.content, 3, undefined, true, undefined, affixLineFit);
    expect(affixLineFit.maxLineBoxHeight).toBeGreaterThan(0);

    host.text.textContent = "Release dashboards keep response ownership visible";
    const exactTwoLines = fitsContent(host.root, host.content, 2, undefined, true);
    const fastTwoLines = fitsContent(
      host.root,
      host.content,
      2,
      undefined,
      true,
      undefined,
      affixLineFit,
    );
    const exactThreeLines = fitsContent(host.root, host.content, 3, undefined, true);
    const fastThreeLines = fitsContent(
      host.root,
      host.content,
      3,
      undefined,
      true,
      undefined,
      affixLineFit,
    );

    expect(fastTwoLines).toBe(exactTwoLines);
    expect(fastThreeLines).toBe(exactThreeLines);
  });

  it("verifies affix height overflow before rejecting line-limited content", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(170);
    const after = document.createElement("button");
    after.textContent = "more";
    after.style.cssText = "font:inherit;margin-left:4px;padding:0;border:0;background:transparent";
    host.content.append(after);
    host.text.textContent = "Release dashboards keep response ownership visible";

    expect(fitsContent(host.root, host.content, 3, undefined, true)).toBe(true);

    const height = host.content.getBoundingClientRect().height;
    const conservativeHeightFit: SimpleLineFit = {
      lineHeight: (height - 1) / 2.5,
      maxLineBoxHeight: 1,
    };

    expect(
      fitsContent(host.root, host.content, 3, undefined, true, undefined, conservativeHeightFit),
    ).toBe(false);
    expect(
      fitsContent(host.root, host.content, 3, undefined, true, undefined, {
        ...conservativeHeightFit,
        verifyOverflow: true,
      }),
    ).toBe(true);
  });

  it("caches exact affix overflow heights after verification", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(170);
    const after = document.createElement("button");
    after.textContent = "more";
    after.style.cssText = "font:inherit;margin-left:4px;padding:0;border:0;background:transparent";
    host.content.append(after);
    host.text.textContent =
      "Release dashboards keep response ownership visible while on-call owners rotate";
    const baseFit = simpleLineFitFromStyle(getComputedStyle(host.text));
    if (!baseFit) {
      throw new Error("Expected text metrics to expose a simple line fit.");
    }

    const candidateTexts = [
      "Release dashboards keep response ownership visible while owners rotate",
      "Release dashboards keep response ownership visible while on-call owners rotate",
      "Release dashboards keep response ownership visible while on-call owners rotate today",
      "Release dashboards keep response ownership visible while on-call owners rotate during incidents",
    ];
    let overflowText = "";

    for (const candidate of candidateTexts) {
      host.text.textContent = candidate;
      const trialFit: SimpleLineFit = {
        lineHeight: baseFit.lineHeight,
        maxLineBoxHeight: baseFit.lineHeight,
        verifyOverflow: true,
      };
      let fits = true;
      const calls = countClientRectsDuring(host.content, () => {
        fits = fitsContent(host.root, host.content, 3, undefined, true, undefined, trialFit);
      });

      if (!fits && calls > 0) {
        overflowText = candidate;
        break;
      }
    }

    expect(overflowText).not.toBe("");
    host.text.textContent = overflowText;
    const affixLineFit: SimpleLineFit = {
      lineHeight: baseFit.lineHeight,
      maxLineBoxHeight: baseFit.lineHeight,
      verifyOverflow: true,
    };

    const firstCalls = countClientRectsDuring(host.content, () => {
      expect(
        fitsContent(host.root, host.content, 3, undefined, true, undefined, affixLineFit),
      ).toBe(false);
    });
    const secondCalls = countClientRectsDuring(host.content, () => {
      expect(
        fitsContent(host.root, host.content, 3, undefined, true, undefined, affixLineFit),
      ).toBe(false);
    });

    expect(firstCalls).toBeGreaterThan(0);
    expect(secondCalls).toBe(0);
    expect(affixLineFit.minOverflowHeight).toBeGreaterThan(0);
  });

  it("uses content bounds for max-height-only fitting", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(170);
    host.root.style.maxHeight = "40px";
    host.root.style.overflow = "hidden";
    const before = document.createElement("strong");
    before.textContent = "SLO";
    before.style.marginRight = "4px";
    const after = document.createElement("button");
    after.textContent = "more";
    after.style.cssText = "font:inherit;margin-left:4px;padding:0;border:0;background:transparent";
    host.content.prepend(before);
    host.content.append(after);

    for (const text of [
      "Release status visible",
      "Release dashboards keep response ownership visible while container width changes",
    ]) {
      host.text.textContent = text;
      const exact = exactMaxHeightFits(host.root, host.content);
      const calls = countClientRectsDuring(host.content, () => {
        expect(fitsContent(host.root, host.content, undefined, "40px")).toBe(exact);
      });

      expect(calls).toBe(0);
    }
  });

  it("keeps cached max-height bounds aligned when candidate height moves the root", async () => {
    await document.fonts?.ready;

    const layouts = [
      {
        container: "height:160px;display:flex;align-items:center",
        root: "",
      },
      {
        container: "height:160px;position:relative",
        root: "position:absolute;bottom:0;left:0",
      },
    ];
    const candidates = [
      "Release status visible",
      "Release dashboards keep response ownership visible while container width changes",
      "Release status visible again",
      "Release dashboards keep response ownership visible while container width changes again",
    ];

    for (const layout of layouts) {
      const host = mountLayoutHost(170);
      host.container.style.cssText = layout.container;
      host.root.style.cssText += `;max-height:40px;overflow:hidden;${layout.root}`;
      const cache = {};
      const seenTops = new Set<number>();

      for (const text of candidates) {
        host.text.textContent = text;
        seenTops.add(Math.round(visibleRootTop(host.root) * 1000));
        const exact = exactMaxHeightFits(host.root, host.content);
        const calls = countClientRectsDuring(host.content, () => {
          expect(fitsContent(host.root, host.content, undefined, "40px", false, cache)).toBe(exact);
        });

        expect(calls).toBe(0);
      }

      expect(seenTops.size).toBeGreaterThan(1);
    }
  });

  it("reuses clientTop while refreshing moved max-height bounds", async () => {
    await document.fonts?.ready;

    const host = mountLayoutHost(170);
    host.container.style.cssText = "height:160px;display:flex;align-items:center";
    host.root.style.cssText += ";max-height:40px;overflow:hidden";
    const cache = {};
    const candidates = [
      "Release status visible",
      "Release dashboards keep response ownership visible while container width changes",
      "Release status visible again",
      "Release dashboards keep response ownership visible while container width changes again",
    ];
    const exactResults = candidates.map((text) => {
      host.text.textContent = text;
      return exactMaxHeightFits(host.root, host.content);
    });

    const calls = countClientTopDuring(host.root, () => {
      for (let index = 0; index < candidates.length; index += 1) {
        const text = candidates[index]!;
        host.text.textContent = text;
        expect(fitsContent(host.root, host.content, undefined, "40px", false, cache)).toBe(
          exactResults[index],
        );
      }
    });

    expect(calls).toBe(1);
  });

  it("does not reuse layout hints learned under another line limit", async () => {
    await expectStaleHintIgnored({ lineLimit: 1 }, {}, (result) => {
      expect(result?.lineLimit).toBe(3);
    });
  });

  it("does not reuse layout hints learned under another line capacity", async () => {
    await expectStaleHintIgnored({ lineCapacity: 1 }, { lineCapacity: 3 }, (result) => {
      expect(result?.lineCapacity).toBe(3);
    });
  });

  it("does not reuse layout hints learned under another max height", async () => {
    await expectStaleHintIgnored({ maxHeight: "20px" }, {}, (result) => {
      expect(result?.maxHeight).toBeUndefined();
    });
  });

  it("does not reuse layout hints learned under another affix layout", async () => {
    await expectStaleHintIgnored(
      { layoutKey: affixLayoutKey("80x20") },
      { layoutKey: affixLayoutKey("20x20") },
      (result) => {
        expect(result?.layoutKey).toBe(affixLayoutKey("20x20"));
      },
    );
  });

  it("does not reuse layout hints learned under another ellipsis", async () => {
    await expectStaleHintIgnored({ ellipsis: "…" }, { ellipsis: "[more]" }, (result) => {
      expect(result?.ellipsis).toBe("[more]");
    });
  });

  it("does not reuse layout hints learned under another clamp ratio", async () => {
    await expectStaleHintIgnored({ ratio: 0 }, { ratio: 1 }, (result) => {
      expect(result?.ratio).toBe(1);
    });
  });

  it("keeps observed rank slope usable after a same-width recompute", async () => {
    const prepared = prepareText(longWordText(), "word");
    const host = mountLayoutHost(240);
    const hint: TextClampResult = {
      boundaryOffsets: prepared.boundaryOffsets,
      ellipsis: "…",
      kept: 0,
      layoutKey: noAffixLayoutKey,
      lineCapacity: 3,
      lineLimit: 3,
      maxHeight: undefined,
      rankPerPx: 0.1,
      rankPerPxWidth: 40,
      ratio: 1,
      rootWidth: 220,
      spacing: "trim",
      text: "…",
    };

    const writes = textWritesDuring(host.text, () =>
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        hint,
        lineCapacity: 3,
        layoutKey: noAffixLayoutKey,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      }),
    );

    expect(writes).toContain("…");
  });

  it("reuses a stable full-text fit when width grows", async () => {
    const text = "Release ownership stays visible.";
    const prepared = prepareText(text, "word");
    const host = mountLayoutHost(280);
    const hint: TextClampResult = {
      boundaryOffsets: prepared.boundaryOffsets,
      ellipsis: "…",
      kept: prepared.boundaryOffsets.length - 1,
      layoutKey: noAffixLayoutKey,
      lineCapacity: 3,
      lineLimit: 3,
      maxHeight: undefined,
      ratio: 1,
      rootWidth: 220,
      spacing: "trim",
      text,
    };
    const state: { result: TextClampResult | null } = { result: null };

    host.text.textContent = text;
    const sample = sampleFitCostDuring(host.root, host.content, () => {
      state.result = clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        hint,
        lineCapacity: 3,
        layoutKey: noAffixLayoutKey,
        lineLimit: 3,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        reuseFullFitOnGrow: true,
        target: host.text,
      });
    });
    const result = state.result;

    if (!result) {
      throw new Error("Expected full-text grow reuse to return a result.");
    }

    expect(result.text).toBe(text);
    expect(result.kept).toBe(prepared.boundaryOffsets.length - 1);
    expect(result.rootWidth).toBe(host.width);
    expect(sample.contentBoundingRectReads).toBe(0);
    expect(sample.rootBoundingRectReads).toBe(0);
    expect(sample.clientRectReads).toBe(0);
  });

  it("verifies same-width full text before accepting a clamped warm result", async () => {
    await document.fonts?.ready;

    const text = "abci";
    const ellipsis = "WWWW";
    const prepared = prepareText(text);
    const width = Math.ceil(measuredTextWidth(text, "font:16px Georgia, serif") + 1);
    const host = mountLayoutHost(width);
    const hint: TextClampResult = {
      boundaryOffsets: prepared.boundaryOffsets,
      ellipsis,
      kept: 3,
      layoutKey: noAffixLayoutKey,
      lineCapacity: 1,
      lineLimit: 1,
      maxHeight: undefined,
      ratio: 1,
      rootWidth: width,
      spacing: "trim",
      text: `abc${ellipsis}`,
    };

    expect(measuredTextWidth(`abc${ellipsis}`, "font:16px Georgia, serif")).toBeGreaterThan(width);

    const result = clampTextToLayout({
      content: host.content,
      ellipsis,
      hint,
      lineCapacity: 1,
      layoutKey: noAffixLayoutKey,
      lineLimit: 1,
      maxHeight: undefined,
      prepared,
      ratio: 1,
      root: host.root,
      rootWidth: width,
      target: host.text,
    });

    expect(result?.text).toBe(text);
    expect(result?.kept).toBe(prepared.boundaryOffsets.length - 1);
  });

  it("warm-starts fallback grapheme search on word-boundary shrinks", async () => {
    const text = "supercalifragilisticexpialidocious";
    const prepared = prepareText(text, "word");
    const fallbackBoundaryOffsets = prepared.fallbackBoundaryOffsets;
    if (!fallbackBoundaryOffsets) {
      throw new Error("Expected word preparation to expose fallback grapheme boundaries.");
    }

    const host = mountLayoutHost(72);
    const hint: TextClampResult = {
      boundaryOffsets: fallbackBoundaryOffsets,
      ellipsis: "…",
      kept: 12,
      layoutKey: noAffixLayoutKey,
      lineCapacity: 1,
      lineLimit: 1,
      maxHeight: undefined,
      ratio: 1,
      rootWidth: 96,
      spacing: "trim",
      text: "supercalifra…",
    };

    const writes = textWritesDuring(host.text, () =>
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        hint,
        lineCapacity: 1,
        layoutKey: noAffixLayoutKey,
        lineLimit: 1,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      }),
    );

    expect(writes.some((value) => value !== "…" && value.includes("…"))).toBe(true);
  });

  it("warm-starts fallback grapheme search on word-boundary grows within a proved fallback width", async () => {
    const text = "supercalifragilisticexpialidocious";
    const prepared = prepareText(text, "word");
    const fallbackBoundaryOffsets = prepared.fallbackBoundaryOffsets;
    if (!fallbackBoundaryOffsets) {
      throw new Error("Expected word preparation to expose fallback grapheme boundaries.");
    }

    const host = mountLayoutHost(104);
    const hint: TextClampResult = {
      boundaryOffsets: fallbackBoundaryOffsets,
      ellipsis: "…",
      kept: 12,
      layoutKey: noAffixLayoutKey,
      lineCapacity: 1,
      lineLimit: 1,
      maxHeight: undefined,
      ratio: 1,
      rootWidth: 72,
      spacing: "trim",
      text: "supercalifra…",
      wordFallbackMaxWidth: 128,
    };

    const writes = textWritesDuring(host.text, () =>
      clampTextToLayout({
        content: host.content,
        ellipsis: "…",
        hint,
        lineCapacity: 1,
        layoutKey: noAffixLayoutKey,
        lineLimit: 1,
        maxHeight: undefined,
        prepared,
        ratio: 1,
        root: host.root,
        rootWidth: host.width,
        target: host.text,
      }),
    );

    expect(writes.some((value) => value !== "…" && value.includes("…"))).toBe(true);
  });

  it("estimates line capacity from numeric and px max-height values", () => {
    const host = mountLayoutHost(220);

    expect(estimateLineCapacity(host.root, 60, undefined)).toBe(3);
    expect(estimateLineCapacity(host.root, "40px", undefined)).toBe(2);
    expect(estimateLineCapacity(host.root, "40px", 1)).toBe(1);
  });

  it("keeps unresolved CSS max-height lengths out of line-capacity hints", () => {
    const host = mountLayoutHost(220);

    host.root.style.maxHeight = "2.5em";
    expect(estimateLineCapacity(host.root, "2.5em", undefined)).toBeUndefined();
  });
});
