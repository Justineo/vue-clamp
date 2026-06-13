import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  emptyBorderBoxSignature,
  estimateLineCapacity,
  fitsContent,
  simpleLineFitFromStyle,
  visibleRootTop,
} from "../src/layout.ts";
import { clampTextToLayout, prepareText } from "../src/text.ts";

import type { SimpleLineFit } from "../src/layout.ts";
import type { TextClampLayoutInput, TextClampResult } from "../src/text.ts";

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

function countClientTopDuring(element: Element, run: () => void): number {
  let owner: object | null = element;
  let descriptor: PropertyDescriptor | undefined;

  while (owner && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(owner, "clientTop");
    if (!descriptor) {
      owner = Object.getPrototypeOf(owner);
    }
  }

  if (!owner || !descriptor?.get) {
    throw new Error("Expected clientTop to be an accessor property.");
  }

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
  it("avoids text rect-list line counting for simple text with roomy line metrics", async () => {
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

    expect(simpleLineFit.lineHeight).toBe(20);
    expect(simpleLineFit.maxLineBoxHeight).toBe(20);
    expect(calls).toBe(0);
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
        forceSkipFullFit: true,
        target: host.text,
      }),
    );

    expect(writes[0]).toBe("…");
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
      forceSkipFullFit: true,
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
        forceSkipFullFit: true,
        target: host.text,
      }),
    );

    expect(writes[0]).not.toBe("…");
    expect(writes[0]).toContain("…");
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
        forceSkipFullFit: true,
        target: host.text,
      }),
    );

    expect(writes[0]).not.toBe("…");
    expect(writes[0]).toContain("…");
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
