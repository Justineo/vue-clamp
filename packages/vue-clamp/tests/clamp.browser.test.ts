import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Comment, createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp, RichLineClamp } from "../src/index.ts";
import { clampRich, patchRich, prepareRich, rankRichState, richStateForRank } from "../src/rich.ts";
import { estimateColdSearchMaxProbeCount, richWarmExpansionLimit } from "../src/search.ts";
import {
  estimateTargetRankInterval,
  estimateTargetRankLocalInterval,
  estimateWarmSearchWidthRoom,
  warmSearchAdvanceWindow,
  warmSearchDecision,
} from "./search-model.ts";
import {
  accessibleTextElement,
  afterElement,
  bestBrowserFitText,
  bodyElement,
  beforeElement,
  cleanupMounted,
  mountClamp,
  mountRichClamp,
  richContentElement,
  rootElement,
  sampleVisibleLineCounts,
  settle,
  textElement,
  visibleLineCount,
  waitUntilVisible,
} from "./browser.ts";

import type { LineClampExposed, RichLineClampExposed } from "../src/index.ts";
import type { PreparedRich, RichClampResult, RichStateRank, RichState } from "../src/rich.ts";
import type { RankAdvance, TargetRankInterval, WarmColdDecision } from "./search-model.ts";

const DEMO_TEXT =
  "Vue (pronounced /vjuː/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";
const RICH_TEXT_HTML =
  '<strong>Vue</strong> ships <img alt="" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2212%22 viewBox=%220 0 24 12%22%3E%3Crect width=%2224%22 height=%2212%22 rx=%226%22 fill=%22%23005BD2%22/%3E%3C/svg%3E" style="width:24px;height:12px;vertical-align:baseline" /> <a href="/docs">layout-aware rich text clamping</a> for <em>inline content</em> and trailing markup.';
const REMOTE_IMAGE_RICH_TEXT_HTML =
  '<strong>Vue</strong> ships <img alt="" src="/rich-demo-icon.svg" style="width:14px;height:14px;vertical-align:-2px" /> <a href="/docs">layout-aware rich text clamping</a> for <em>inline content</em> and trailing markup.';
const BEHAVIORAL_RICH_TEXT_HTML =
  '<section style="display:inline">Semantic</section> beside <div style="display:inline">behavior wrapper</div> with trailing copy that needs truncation.';
const ATOMIC_LEAF_RICH_TEXT_HTML =
  '<span style="display:inline-block;width:24px;height:12px;vertical-align:baseline"></span> trailing copy that still needs clamping.';
const INLINE_BLOCK_RICH_TEXT_HTML =
  'Lead <span class="inline-box" style="display:inline-block">AtomicBox</span> trailing copy that should not split inside the inline box.';
const RICH_DYNAMIC_TOKEN_HTML =
  '<span class="dynamic-token">observabilityPlatform1</span> trailing copy';

type RichClampFixture = {
  body: HTMLElement;
  clamp: () => RichClampResult;
  cleanup: () => void;
  content: HTMLElement;
  prepared: PreparedRich;
  reclamp: (previous: RichClampResult) => RichClampResult;
  root: HTMLElement;
  styles: HTMLStyleElement[];
};

type RichClampFixtureOptions = {
  affixWidths?: readonly [number, number];
  className?: string;
  html?: string;
  lineLimit?: number | undefined;
  maxHeight?: string;
  rootStyle?: readonly string[];
  styles?: readonly string[];
  width?: number;
};

function expectEndWordBoundary(sourceText: string, clampedText: string): void {
  const prefix = clampedText.replace(/…$/u, "").trim();

  expect(clampedText.endsWith("…")).toBe(true);
  expect(sourceText.startsWith(prefix)).toBe(true);
  expect(prefix.length === 0 || sourceText[prefix.length] === " ").toBe(true);
}

afterEach(() => {
  cleanupMounted();
});

function richImage(root: HTMLElement, message: string): HTMLImageElement {
  const image = richContentElement(root).querySelector("img");
  if (!(image instanceof HTMLImageElement)) {
    throw new Error(message);
  }

  return image;
}

function lineContentElement(root: HTMLElement): HTMLElement {
  const content = root.querySelector('[data-part="content"]');
  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected line clamp content element.");
  }

  return content;
}

async function collectFontEventMutations(
  root: HTMLElement,
  event: Event,
): Promise<MutationRecord[]> {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((items) => {
    records.push(...items);
  });

  observer.observe(root, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  observer.takeRecords();
  document.fonts?.dispatchEvent(event);
  await settle(5);
  records.push(...observer.takeRecords());
  observer.disconnect();

  return records;
}

function genericFontEvent(): Event {
  return new Event("loadingdone");
}

function fontFaceEvent(family: string): Event {
  const face = new FontFace(family, "local(Arial)");

  return new FontFaceSetLoadEvent("loadingdone", {
    fontfaces: [face],
  });
}

function usedFontFaceEvent(): Event {
  return fontFaceEvent("Georgia");
}

function inlineBodyElement(root: HTMLElement): HTMLElement {
  const body = root.querySelector('[data-part="body"]');
  if (!(body instanceof HTMLElement)) {
    throw new Error("Expected inline clamp body element.");
  }

  return body;
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

function countBoundingRectsDuring(run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect");
  const original = descriptor?.value as ((this: Element) => DOMRect) | undefined;
  if (!descriptor || !original) {
    throw new Error("Expected Element.prototype.getBoundingClientRect to be patchable.");
  }

  let calls = 0;
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    ...descriptor,
    value(this: Element): DOMRect {
      calls += 1;

      return original.call(this);
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(Element.prototype, "getBoundingClientRect", descriptor);
  }

  return calls;
}

function countComputedStylesDuring(run: () => void): number {
  const original = window.getComputedStyle;
  let calls = 0;
  window.getComputedStyle = ((...args: Parameters<typeof window.getComputedStyle>) => {
    calls += 1;
    return original(...args);
  }) as typeof window.getComputedStyle;

  try {
    run();
  } finally {
    window.getComputedStyle = original;
  }

  return calls;
}

type MutationSummary = {
  readonly addedNodes: number;
  readonly characterData: number;
  readonly childList: number;
  readonly records: number;
  readonly removedNodes: number;
};

type RichProbeCostSample = {
  readonly boundingRectReads: number;
  readonly cloneCalls: number;
  readonly clientRectReads: number;
  readonly clientRectEntries: number;
  readonly imageCloneCalls: number;
  readonly mutations: MutationSummary;
  readonly styleReads: number;
};

type RichProbeCostTotal = RichProbeCostSample & {
  readonly layoutReads: number;
  readonly probes: number;
};

type RichPatchClass =
  | "clamped-to-full"
  | "full-to-clamped"
  | "same-state"
  | "same-text-cut"
  | "whole-prefix";

type RichPatchCostVector = {
  readonly addedNodes: number;
  readonly clientRectEntries: number;
  readonly cloneCalls: number;
  readonly layoutReads: number;
  readonly probes: number;
  readonly removedNodes: number;
  readonly styleReads: number;
};

type RichProbePatchKind = "none" | "structure" | "text";

function samePath(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function richPatchClass(from: RichState, to: RichState): RichPatchClass {
  if (from.kind === "full") {
    return to.kind === "full" ? "same-state" : "full-to-clamped";
  }

  if (to.kind === "full") {
    return "clamped-to-full";
  }

  if (from.point.offset === to.point.offset && samePath(from.point.path, to.point.path)) {
    return "same-state";
  }

  return samePath(from.point.path, to.point.path) ? "same-text-cut" : "whole-prefix";
}

function richPatchMutationMatchesClass(
  mutation: MutationSummary,
  patchClass: RichPatchClass,
): boolean {
  if (patchClass === "same-state") {
    return mutation.records === 0;
  }

  if (patchClass === "same-text-cut") {
    return (
      mutation.characterData > 0 &&
      mutation.childList === 0 &&
      mutation.addedNodes === 0 &&
      mutation.removedNodes === 0
    );
  }

  if (mutation.childList <= 0) {
    return false;
  }

  if (patchClass === "full-to-clamped") {
    return mutation.removedNodes > 0;
  }

  if (patchClass === "clamped-to-full") {
    return mutation.addedNodes > 0;
  }

  return mutation.addedNodes + mutation.removedNodes > 0;
}

function richWarmPatchVectorDominates(
  warm: RichPatchCostVector,
  cold: RichPatchCostVector,
): boolean {
  return (
    warm.probes <= cold.probes &&
    warm.layoutReads <= cold.layoutReads &&
    warm.clientRectEntries <= cold.clientRectEntries &&
    warm.styleReads <= cold.styleReads &&
    warm.removedNodes <= cold.removedNodes &&
    warm.cloneCalls <= cold.cloneCalls &&
    warm.addedNodes <= cold.addedNodes &&
    (warm.cloneCalls < cold.cloneCalls || warm.addedNodes < cold.addedNodes)
  );
}

function emptyMutationSummary(): MutationSummary {
  return {
    addedNodes: 0,
    characterData: 0,
    childList: 0,
    records: 0,
    removedNodes: 0,
  };
}

function summarizeMutations(records: readonly MutationRecord[]): MutationSummary {
  return records.reduce<MutationSummary>(
    (summary, record) => ({
      addedNodes: summary.addedNodes + record.addedNodes.length,
      characterData: summary.characterData + (record.type === "characterData" ? 1 : 0),
      childList: summary.childList + (record.type === "childList" ? 1 : 0),
      records: summary.records + 1,
      removedNodes: summary.removedNodes + record.removedNodes.length,
    }),
    emptyMutationSummary(),
  );
}

function addMutationSummary(left: MutationSummary, right: MutationSummary): MutationSummary {
  return {
    addedNodes: left.addedNodes + right.addedNodes,
    characterData: left.characterData + right.characterData,
    childList: left.childList + right.childList,
    records: left.records + right.records,
    removedNodes: left.removedNodes + right.removedNodes,
  };
}

function sumRichProbeCosts(samples: readonly RichProbeCostSample[]): RichProbeCostTotal {
  return samples.reduce<RichProbeCostTotal>(
    (total, sample) => ({
      boundingRectReads: total.boundingRectReads + sample.boundingRectReads,
      cloneCalls: total.cloneCalls + sample.cloneCalls,
      clientRectEntries: total.clientRectEntries + sample.clientRectEntries,
      clientRectReads: total.clientRectReads + sample.clientRectReads,
      imageCloneCalls: total.imageCloneCalls + sample.imageCloneCalls,
      layoutReads: total.layoutReads + sample.boundingRectReads + sample.clientRectReads,
      mutations: addMutationSummary(total.mutations, sample.mutations),
      probes: total.probes + 1,
      styleReads: total.styleReads + sample.styleReads,
    }),
    {
      boundingRectReads: 0,
      cloneCalls: 0,
      clientRectEntries: 0,
      clientRectReads: 0,
      imageCloneCalls: 0,
      layoutReads: 0,
      mutations: emptyMutationSummary(),
      probes: 0,
      styleReads: 0,
    },
  );
}

function richProbePatchKind(sample: RichProbeCostSample): RichProbePatchKind {
  if (sample.mutations.childList > 0) {
    return "structure";
  }

  return sample.mutations.characterData > 0 ? "text" : "none";
}

function expectObservedRichPatchCostClass(
  summary: MutationSummary,
  costClass: RichPatchClass,
): void {
  expect(richPatchMutationMatchesClass(summary, costClass)).toBe(true);
}

async function observeMutationsDuring(target: Node, run: () => void): Promise<MutationSummary> {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((nextRecords) => {
    records.push(...nextRecords);
  });

  observer.observe(target, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  run();
  await Promise.resolve();
  observer.disconnect();

  return summarizeMutations(records);
}

async function collectRichProbeCostsDuring(
  content: HTMLElement,
  body: HTMLElement,
  run: () => void,
): Promise<RichProbeCostSample[]> {
  const boundingRectDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "getBoundingClientRect",
  );
  const originalGetBoundingClientRect = boundingRectDescriptor?.value as
    | ((this: Element) => DOMRect)
    | undefined;
  const rectsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects");
  const originalGetClientRects = rectsDescriptor?.value as
    | ((this: Element) => DOMRectList)
    | undefined;
  const cloneDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "cloneNode");
  const originalCloneNode = cloneDescriptor?.value as
    | ((this: Node, deep?: boolean) => Node)
    | undefined;
  const rangeCloneDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "cloneContents");
  const originalRangeClone = rangeCloneDescriptor?.value as
    | ((this: Range) => DocumentFragment)
    | undefined;
  if (
    !boundingRectDescriptor ||
    !originalGetBoundingClientRect ||
    !rectsDescriptor ||
    !originalGetClientRects ||
    !cloneDescriptor ||
    !originalCloneNode ||
    !rangeCloneDescriptor ||
    !originalRangeClone
  ) {
    throw new Error("Expected DOM probe methods to be patchable.");
  }

  const originalGetComputedStyle = window.getComputedStyle;
  const observer = new MutationObserver(() => {});
  const samples: RichProbeCostSample[] = [];
  let cloneCalls = 0;
  let imageCloneCalls = 0;
  let styleReads = 0;

  observer.observe(body, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  function pushSample(
    boundingRectReads: number,
    clientRectReads: number,
    clientRectEntries: number,
  ): void {
    samples.push({
      boundingRectReads,
      cloneCalls,
      clientRectEntries,
      clientRectReads,
      imageCloneCalls,
      mutations: summarizeMutations(observer.takeRecords()),
      styleReads,
    });
    cloneCalls = 0;
    imageCloneCalls = 0;
    styleReads = 0;
  }

  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    ...boundingRectDescriptor,
    value(this: Element): DOMRect {
      const result = originalGetBoundingClientRect.call(this);

      if (this === content) {
        pushSample(1, 0, 0);
      }

      return result;
    },
  });
  Object.defineProperty(Element.prototype, "getClientRects", {
    ...rectsDescriptor,
    value(this: Element): DOMRectList {
      const result = originalGetClientRects.call(this);

      if (this === content) {
        pushSample(0, 1, result.length);
      }

      return result;
    },
  });
  Object.defineProperty(Node.prototype, "cloneNode", {
    ...cloneDescriptor,
    value(this: Node, deep?: boolean): Node {
      cloneCalls += 1;
      if (this instanceof HTMLImageElement) {
        imageCloneCalls += 1;
      }

      return originalCloneNode.call(this, deep);
    },
  });
  Object.defineProperty(Range.prototype, "cloneContents", {
    ...rangeCloneDescriptor,
    value(this: Range): DocumentFragment {
      const fragment = originalRangeClone.call(this);
      const elements = fragment.querySelectorAll("*");
      cloneCalls += elements.length;
      imageCloneCalls += fragment.querySelectorAll("img").length;
      return fragment;
    },
  });
  window.getComputedStyle = ((...args: Parameters<typeof window.getComputedStyle>) => {
    styleReads += 1;
    return originalGetComputedStyle(...args);
  }) as typeof window.getComputedStyle;

  try {
    run();
    await Promise.resolve();
  } finally {
    observer.disconnect();
    Object.defineProperty(Element.prototype, "getBoundingClientRect", boundingRectDescriptor);
    Object.defineProperty(Element.prototype, "getClientRects", rectsDescriptor);
    Object.defineProperty(Node.prototype, "cloneNode", cloneDescriptor);
    Object.defineProperty(Range.prototype, "cloneContents", rangeCloneDescriptor);
    window.getComputedStyle = originalGetComputedStyle;
  }

  return samples;
}

function countStyleSheetRuleReadsDuring(run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
  if (!descriptor?.get) {
    throw new Error("Expected CSSStyleSheet.prototype.cssRules to be patchable.");
  }
  const cssRulesDescriptor = descriptor as PropertyDescriptor & {
    get(this: CSSStyleSheet): CSSRuleList;
  };

  let calls = 0;
  Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
    ...cssRulesDescriptor,
    get(this: CSSStyleSheet): CSSRuleList {
      calls += 1;
      return Reflect.apply(cssRulesDescriptor.get, this, []) as CSSRuleList;
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(CSSStyleSheet.prototype, "cssRules", descriptor);
  }

  return calls;
}

function withUnreadableStyleSheetRules<T>(sheet: CSSStyleSheet, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
  if (!descriptor?.get) {
    throw new Error("Expected CSSStyleSheet.prototype.cssRules to be patchable.");
  }
  const cssRulesDescriptor = descriptor as PropertyDescriptor & {
    get(this: CSSStyleSheet): CSSRuleList;
  };

  Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
    ...cssRulesDescriptor,
    get(this: CSSStyleSheet): CSSRuleList {
      if (this === sheet) {
        throw new Error("Stylesheet rules are not readable.");
      }

      return Reflect.apply(cssRulesDescriptor.get, this, []) as CSSRuleList;
    },
  });

  try {
    return run();
  } finally {
    Object.defineProperty(CSSStyleSheet.prototype, "cssRules", descriptor);
  }
}

function richFixtureLineLimit(options: {
  readonly lineLimit?: number | undefined;
  readonly maxHeight?: string | undefined;
}): number | undefined {
  return options.lineLimit ?? (options.maxHeight === undefined ? 1 : undefined);
}

function createRichClampFixture({
  affixWidths,
  className,
  html = RICH_DYNAMIC_TOKEN_HTML,
  lineLimit,
  maxHeight,
  rootStyle = [],
  styles = [],
  width = 120,
}: RichClampFixtureOptions = {}): RichClampFixture {
  const prepared = prepareRich(html, "word");
  if (!prepared) {
    throw new Error("Expected rich preparation to be available.");
  }
  const preparedRich = prepared;
  const clampLineLimit = richFixtureLineLimit({ lineLimit, maxHeight });

  const styleElements = styles.map((text) => {
    const style = document.createElement("style");
    style.textContent = text;
    document.head.append(style);
    return style;
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = document.createElement("div");
  if (className) {
    root.className = className;
  }
  root.style.cssText = [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    "white-space:normal",
    "overflow-wrap:break-word",
    ...(maxHeight === undefined ? [] : [`max-height:${maxHeight}`, "overflow:hidden"]),
    ...rootStyle,
  ].join(";");
  const content = document.createElement("span");
  const body = document.createElement("span");
  body.innerHTML = html;
  if (affixWidths) {
    const before = document.createElement("span");
    before.style.cssText = `display:inline-block;width:${affixWidths[0]}px;height:16px;vertical-align:baseline`;
    content.append(before);
  }
  content.append(body);
  if (affixWidths) {
    const after = document.createElement("span");
    after.style.cssText = `display:inline-block;width:${affixWidths[1]}px;height:16px;vertical-align:baseline`;
    content.append(after);
  }
  root.append(content);
  container.append(root);

  function clamp(
    from: RichState | null = null,
    searchIndex: RichClampResult["searchIndex"] = null,
  ): RichClampResult {
    return clampRich({
      ellipsis: "…",
      from,
      hint: from,
      lineLimit: clampLineLimit,
      maxHeight,
      prepared: preparedRich,
      probe: {
        body,
        content,
        root,
        width,
      },
      searchIndex,
    });
  }

  return {
    body,
    clamp,
    cleanup(): void {
      for (const style of styleElements) {
        style.remove();
      }
      container.remove();
    },
    content,
    prepared: preparedRich,
    reclamp(previous): RichClampResult {
      return clamp(previous.state, previous.searchIndex ?? null);
    },
    root,
    styles: styleElements,
  };
}

async function richRankForLayout(options: RichClampFixtureOptions): Promise<number> {
  const fixture = createRichClampFixture(options);

  try {
    await settle(1);
    const result = fixture.clamp();
    if (result.rank === undefined) {
      throw new Error("Expected rich clamp result to publish a rank.");
    }

    return result.rank;
  } finally {
    fixture.cleanup();
  }
}

type RichMixedRankSample = RichStateRank & {
  readonly publishedRank: number | undefined;
};

type RichMixedRankIntervalInput = Omit<RichClampFixtureOptions, "width"> & {
  readonly lineCapacity: number;
  readonly nextWidth: number;
  readonly packingSlack?: number;
  readonly previousWidth: number;
  readonly text: string;
};

async function richMixedRankForLayout(
  options: RichClampFixtureOptions,
): Promise<RichMixedRankSample> {
  const fixture = createRichClampFixture(options);

  try {
    await settle(1);
    const result = fixture.clamp();
    if (!result.searchIndex || !result.state) {
      throw new Error("Expected rich clamp result to carry searchable state.");
    }

    const rank = rankRichState(result.searchIndex, result.state);
    if (!rank) {
      throw new Error("Expected fallback-aware rich rank to cover the result state.");
    }

    return {
      ...rank,
      publishedRank: result.rank,
    };
  } finally {
    fixture.cleanup();
  }
}

function graphemeParts(text: string): string[] {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
    (part) => part.segment,
  );
}

const stableCalibrationStyle = [
  "font-family:monospace",
  "font-kerning:none",
  "font-variant-ligatures:none",
] as const;

function createTextMeasureProbe(rootStyle: readonly string[]): HTMLSpanElement {
  const probe = document.createElement("span");
  probe.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "white-space:nowrap",
    "font:16px Georgia, serif",
    "line-height:20px",
    ...rootStyle,
  ].join(";");
  document.body.append(probe);

  return probe;
}

function measureTextWidth(text: string, rootStyle: readonly string[] = []): number {
  const probe = createTextMeasureProbe(rootStyle);

  try {
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  } finally {
    probe.remove();
  }
}

function measureAdvances(text: string, rootStyle: readonly string[] = []): number[] {
  const probe = createTextMeasureProbe(rootStyle);

  try {
    const advances: number[] = [];
    const parts = graphemeParts(text);
    probe.textContent = "…";
    let previousWidth = probe.getBoundingClientRect().width;
    let prefix = "";

    for (const part of parts) {
      prefix += part;
      probe.textContent = `${prefix}…`;
      const width = probe.getBoundingClientRect().width;
      const advance = width - previousWidth;
      if (advance > 0) {
        advances.push(advance);
      }
      previousWidth = width;
    }

    return advances;
  } finally {
    probe.remove();
  }
}

type ProbeLineMetrics = {
  readonly lineCount: number;
  readonly maxWidth: number | undefined;
  readonly slack: number | undefined;
  readonly usedWidth: number | undefined;
};

type RichProbeLayout = {
  readonly boundsWidth: number | undefined;
  readonly clientRectReads: number;
  readonly fitProbeCount: number;
  readonly lineCount: number;
  readonly lineSlack: number | undefined;
  readonly lineUsedWidth: number | undefined;
  readonly lineWidth: number | undefined;
  readonly rank: RichStateRank;
  readonly rectReads: number;
};

type RichSearchIndex = NonNullable<RichClampResult["searchIndex"]>;

type RichLayoutSample = {
  readonly bounds: DOMRect;
  readonly rects: readonly DOMRect[];
  readonly state: RichState;
};

function measureRichStateLayout(fixture: RichClampFixture, state: RichState): RichLayoutSample {
  patchRich(fixture.prepared, fixture.body, null, state, "…");

  return {
    bounds: fixture.content.getBoundingClientRect(),
    rects: Array.from(fixture.content.getClientRects()),
    state,
  };
}

function measureRichRankLayout(
  fixture: RichClampFixture,
  searchIndex: RichSearchIndex,
  rank: number,
): RichLayoutSample {
  const state = richStateForRank(searchIndex, rank);
  if (!state) {
    throw new Error("Expected rank to resolve to a rich state.");
  }

  return measureRichStateLayout(fixture, state);
}

function windowRanks(indexes: readonly number[]): number[] {
  const ranks = new Set<number>();

  for (const index of indexes) {
    ranks.add(index);
    ranks.add(index + 1);
  }

  return [...ranks];
}

function advancesFromWidths(widthByRank: ReadonlyMap<number, number>): number[] {
  const advances: number[] = [];

  for (const [rank, width] of widthByRank) {
    const nextWidth = widthByRank.get(rank + 1);
    if (nextWidth !== undefined) {
      advances[rank] = nextWidth - width;
    }
  }

  return advances;
}

function sameProbeLine(
  line: { readonly bottom: number; readonly top: number },
  rect: DOMRect,
): boolean {
  return Math.abs(line.top - rect.top) <= 0.5 && Math.abs(line.bottom - rect.bottom) <= 0.5;
}

function lineMetricsForRects(
  rootWidth: number,
  rects: readonly DOMRect[],
  lineLimit?: number,
): ProbeLineMetrics {
  const lines: Array<{ bottom: number; left: number; right: number; top: number }> = [];

  for (const rect of rects) {
    if (rect.height <= 0) {
      continue;
    }

    const line = lines.find((item) => sameProbeLine(item, rect));
    if (line) {
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
    } else {
      lines.push({
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      });
    }
  }

  if (lines.length === 0) {
    return {
      lineCount: 0,
      maxWidth: undefined,
      slack: undefined,
      usedWidth: undefined,
    };
  }

  const widths = lines.map((line) => Math.max(0, line.right - line.left));
  const usedWidth = widths.reduce((total, width) => total + width, 0);

  const unusedLineCount =
    lineLimit === undefined || lineLimit < lines.length ? 0 : lineLimit - lines.length;

  return {
    lineCount: lines.length,
    maxWidth: Math.max(...widths),
    slack:
      widths.reduce((total, width) => total + Math.max(0, rootWidth - width), 0) +
      unusedLineCount * rootWidth,
    usedWidth,
  };
}

async function collectRichProbeLayout({
  lineLimit,
  maxHeight,
  width = 120,
  ...options
}: RichClampFixtureOptions = {}): Promise<RichProbeLayout> {
  const fixture = createRichClampFixture({
    ...options,
    lineLimit,
    ...(maxHeight === undefined ? {} : { maxHeight }),
    width,
  });
  const fitLineLimit = richFixtureLineLimit({ lineLimit, maxHeight });
  let result: RichClampResult | undefined;

  try {
    const samples = await collectRichProbeCostsDuring(fixture.content, fixture.body, () => {
      result = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: fitLineLimit,
        maxHeight,
        prepared: fixture.prepared,
        probe: {
          body: fixture.body,
          content: fixture.content,
          root: fixture.root,
          width,
        },
      });
    });

    if (!result?.searchIndex || !result.state) {
      throw new Error("Expected one-line rich clamp to publish searchable state.");
    }

    const rank = rankRichState(result.searchIndex, result.state);
    if (!rank) {
      throw new Error("Expected one-line rich clamp to publish a mixed rank.");
    }

    const rectReads = samples.reduce((total, sample) => total + sample.boundingRectReads, 0);
    const clientRectReads = samples.reduce((total, sample) => total + sample.clientRectReads, 0);
    const layout = measureRichStateLayout(fixture, result.state);
    const lineMetrics =
      clientRectReads > 0
        ? lineMetricsForRects(
            width,
            layout.rects,
            maxHeight === undefined ? fitLineLimit : undefined,
          )
        : null;

    return {
      boundsWidth: rectReads > 0 ? layout.bounds.width : undefined,
      clientRectReads,
      fitProbeCount: samples.length,
      lineCount: lineMetrics?.lineCount ?? 0,
      lineSlack: lineMetrics?.slack,
      lineUsedWidth: lineMetrics?.usedWidth,
      lineWidth: lineMetrics?.maxWidth,
      rank,
      rectReads,
    };
  } finally {
    fixture.cleanup();
  }
}

function advanceRange(advances: readonly number[]): RankAdvance {
  let max = 0;
  let min = Number.POSITIVE_INFINITY;

  for (const advance of advances) {
    if (advance > 0) {
      max = Math.max(max, advance);
      min = Math.min(min, advance);
    }
  }

  if (!Number.isFinite(min) || min <= 0 || max <= 0) {
    throw new Error("Expected positive rich candidate advances.");
  }

  return { max, min };
}

async function expectRichMixedRankInterval({
  lineCapacity,
  nextWidth,
  packingSlack,
  previousWidth,
  rootStyle = [],
  text,
  ...fixtureOptions
}: RichMixedRankIntervalInput): Promise<{
  readonly advance: RankAdvance;
  readonly advances: readonly number[];
  readonly interval: TargetRankInterval;
  readonly localInterval: TargetRankInterval;
  readonly next: RichMixedRankSample;
  readonly previous: RichMixedRankSample;
}> {
  const previous = await richMixedRankForLayout({
    ...fixtureOptions,
    rootStyle,
    width: previousWidth,
  });
  const next = await richMixedRankForLayout({
    ...fixtureOptions,
    rootStyle,
    width: nextWidth,
  });
  const advances = measureAdvances(text, rootStyle);
  const advance = advanceRange(advances);
  const interval = estimateTargetRankInterval({
    advance,
    lineCapacity,
    nextWidth,
    previousRank: previous.rank,
    previousWidth,
    rankCount: previous.rankCount,
  });
  const localInterval = estimateTargetRankLocalInterval({
    advance,
    advances,
    lineCapacity,
    nextWidth,
    ...(packingSlack === undefined ? {} : { packingSlack }),
    previousRank: previous.rank,
    previousWidth,
    rankCount: previous.rankCount,
  });

  expect(next.rank).toBeGreaterThanOrEqual(interval.min);
  expect(next.rank).toBeLessThanOrEqual(interval.max);
  expect(next.rank).toBeGreaterThanOrEqual(localInterval.min);
  expect(next.rank).toBeLessThanOrEqual(localInterval.max);

  return { advance, advances, interval, localInterval, next, previous };
}

type RichCostComparisonOptions = Omit<RichClampFixtureOptions, "width"> & {
  readonly nextWidth: number;
  readonly previousWidth: number;
};

type RichCostComparison = {
  readonly cold: RichProbeCostTotal;
  readonly coldResult: RichClampResult | undefined;
  readonly decision: WarmColdDecision | null;
  readonly decisionReason: RichWarmDecisionReason | null;
  readonly mixedDecision: WarmColdDecision | null;
  readonly mixedDecisionReason: RichWarmDecisionReason | null;
  readonly previous: RichClampResult;
  readonly warm: RichProbeCostTotal;
  readonly warmResult: RichClampResult | undefined;
};

type RichWarmDecisionReason = "previous-unranked" | "rank-count-mismatch" | "target-unranked";

type RichWarmDecisionCheck = {
  readonly decision: WarmColdDecision | null;
  readonly reason: RichWarmDecisionReason | null;
};

function richCostVector(total: RichProbeCostTotal): RichPatchCostVector {
  return {
    addedNodes: total.mutations.addedNodes,
    clientRectEntries: total.clientRectEntries,
    cloneCalls: total.cloneCalls,
    layoutReads: total.layoutReads,
    probes: total.probes,
    removedNodes: total.mutations.removedNodes,
    styleReads: total.styleReads,
  };
}

function wholeLayoutReadCredit(comparison: RichCostComparison): number {
  return Math.max(0, comparison.cold.layoutReads - comparison.warm.layoutReads);
}

function richWarmDecision(
  previous: RichClampResult,
  target: RichClampResult | undefined,
): RichWarmDecisionCheck {
  if (previous.rank === undefined || previous.rankCount === undefined) {
    return { decision: null, reason: "previous-unranked" };
  }

  if (target?.rank === undefined || target.rankCount === undefined) {
    return { decision: null, reason: "target-unranked" };
  }

  if (target.rankCount !== previous.rankCount) {
    return { decision: null, reason: "rank-count-mismatch" };
  }

  return {
    decision: warmSearchDecision({
      allowPatchTieBreak: true,
      count: previous.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: previous.rank,
      interval: { max: target.rank, min: target.rank },
    }),
    reason: null,
  };
}

function richMixedWarmDecision(
  previous: RichClampResult,
  target: RichClampResult | undefined,
): RichWarmDecisionCheck {
  if (!previous.searchIndex || !previous.state) {
    return { decision: null, reason: "previous-unranked" };
  }

  if (!target?.searchIndex || !target.state) {
    return { decision: null, reason: "target-unranked" };
  }

  const previousRank = rankRichState(previous.searchIndex, previous.state);
  if (!previousRank) {
    return { decision: null, reason: "previous-unranked" };
  }

  const targetRank = rankRichState(target.searchIndex, target.state);
  if (!targetRank) {
    return { decision: null, reason: "target-unranked" };
  }

  if (targetRank.rankCount !== previousRank.rankCount) {
    return { decision: null, reason: "rank-count-mismatch" };
  }

  return {
    decision: warmSearchDecision({
      allowPatchTieBreak: true,
      count: previousRank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: previousRank.rank,
      interval: { max: targetRank.rank, min: targetRank.rank },
    }),
    reason: null,
  };
}

async function compareRichWarmColdCosts({
  nextWidth,
  previousWidth,
  ...fixtureOptions
}: RichCostComparisonOptions): Promise<RichCostComparison> {
  const warmFixture = createRichClampFixture({
    ...fixtureOptions,
    width: previousWidth,
  });
  const coldFixture = createRichClampFixture({
    ...fixtureOptions,
    width: nextWidth,
  });

  try {
    await settle(1);
    const previous = warmFixture.clamp();
    warmFixture.root.style.width = `${nextWidth}px`;

    let warmResult: RichClampResult | undefined;
    const warmSamples = await collectRichProbeCostsDuring(
      warmFixture.content,
      warmFixture.body,
      () => {
        warmResult = clampRich({
          ellipsis: "…",
          from: previous.state,
          hint: previous.state,
          lineLimit: richFixtureLineLimit(fixtureOptions),
          maxHeight: fixtureOptions.maxHeight,
          preferHintedTextRun: true,
          prepared: warmFixture.prepared,
          probe: {
            body: warmFixture.body,
            content: warmFixture.content,
            root: warmFixture.root,
            width: nextWidth,
          },
          searchIndex: previous.searchIndex ?? null,
          skipFullFit: true,
          verifyFullCandidate: false,
        });
      },
    );

    let coldResult: RichClampResult | undefined;
    const coldSamples = await collectRichProbeCostsDuring(
      coldFixture.content,
      coldFixture.body,
      () => {
        coldResult = coldFixture.clamp();
      },
    );

    const decision = richWarmDecision(previous, coldResult);
    const mixedDecision = richMixedWarmDecision(previous, coldResult);

    return {
      cold: sumRichProbeCosts(coldSamples),
      coldResult,
      decision: decision.decision,
      decisionReason: decision.reason,
      mixedDecision: mixedDecision.decision,
      mixedDecisionReason: mixedDecision.reason,
      previous,
      warm: sumRichProbeCosts(warmSamples),
      warmResult,
    };
  } finally {
    warmFixture.cleanup();
    coldFixture.cleanup();
  }
}

function expectWarmPatchCreditDirection(
  comparison: RichCostComparison,
  requireDecision = true,
): void {
  expect(comparison.previous.state?.kind).toBe("clamped");
  expect(comparison.warmResult?.state?.kind).toBe("clamped");
  expect(comparison.coldResult?.state?.kind).toBe("clamped");
  if (requireDecision) {
    expect(comparison.decision).not.toBeNull();
    expect(comparison.decisionReason).toBeNull();
  }
  if (comparison.decision) {
    expect(comparison.decision.requiredCredit).toBe(0);
    expect(comparison.decision.useWarm).toBe(true);
  }
  if (comparison.mixedDecision) {
    expect(comparison.mixedDecision.requiredCredit).toBe(0);
    expect(comparison.mixedDecision.useWarm).toBe(true);
    expect(comparison.mixedDecisionReason).toBeNull();
  }

  expect(
    richWarmPatchVectorDominates(richCostVector(comparison.warm), richCostVector(comparison.cold)),
  ).toBe(true);
}

describe("LineClamp browser contract", () => {
  it("renders plain text without role or aria-label when no truncation support is needed", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
    });

    await settle();

    const textNode = textElement(rootElement(mounted.container));
    expect(textNode.getAttribute("role")).toBeNull();
    expect(textNode.getAttribute("aria-hidden")).toBeNull();
    expect(textNode.textContent).toBe("abcdefghijklmno");
    expect(textNode.getAttribute("aria-label")).toBeNull();
    expect(accessibleTextElement(rootElement(mounted.container))).toBeNull();
  });

  it("renders the requested root tag through the as prop", async () => {
    const mounted = mountClamp({
      text: "alpha beta",
      props: {
        as: "article",
      },
    });

    await settle();

    const root = rootElement(mounted.container);
    expect(root.tagName).toBe("ARTICLE");
    expect(root.getAttribute("data-part")).toBe("root");
    expect(root.querySelector('[data-part="content"]')).toBeInstanceOf(HTMLElement);
    expect(root.querySelector('[data-part="body"]')).toBeInstanceOf(HTMLElement);
  });

  it("emits update:expanded when the exposed toggle is called", async () => {
    const values: boolean[] = [];
    const mounted = mountClamp({
      text: "abcdefghijklmno",
      props: {
        "onUpdate:expanded"(value: boolean) {
          values.push(value);
        },
      },
    });

    await settle();

    (mounted.exposed.value as LineClampExposed).toggle();
    await settle();

    expect(values.at(-1)).toBe(true);
  });

  it("measures the latest layout when an inactive expanded clamp collapses", async () => {
    const expanded = ref(true);
    const width = ref(420);
    const container = document.createElement("div");
    document.body.append(container);
    const Host = defineComponent({
      setup() {
        return () =>
          h(LineClamp, {
            boundary: "word",
            expanded: expanded.value,
            maxLines: 1,
            "onUpdate:expanded": (value: boolean) => {
              expanded.value = value;
            },
            style: `display:block;width:${width.value}px;font:16px/20px Georgia,serif`,
            text: "Release dashboards preserve current layout context when an expanded clamp later collapses.",
          });
      },
    });
    const app = createApp(Host);

    try {
      app.mount(container);
      await settle();
      width.value = 120;
      await settle();
      expanded.value = false;
      await settle(5);

      const root = rootElement(container);
      expect(textElement(root).textContent).toContain("…");
      expect(visibleLineCount(root)).toBeLessThanOrEqual(1);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("renders atomic before and after slot wrappers", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
      before: () => "Before",
      after: () => "After",
    });

    await settle();

    const root = rootElement(mounted.container);
    expect(beforeElement(root)?.getAttribute("data-part")).toBe("before");
    expect(afterElement(root)?.getAttribute("data-part")).toBe("after");
    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(afterElement(root)?.textContent).toBe("After");
  });

  it("does not render before and after wrappers for empty slot output", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
      before: () => [],
      after: () => h(Comment),
    });

    await settle();

    const root = rootElement(mounted.container);
    expect(beforeElement(root)).toBeNull();
    expect(afterElement(root)).toBeNull();
  });

  it("clamps within the requested line limit when font metrics are inherited from the parent context", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
      applyWidthToComponent: false,
      containerStyle: 'width:180px;font:24px "Times New Roman",serif;line-height:32px',
      style: "font:inherit;line-height:inherit",
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(textElement(root).textContent).toBe(
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
    );
    expect(getComputedStyle(lineContentElement(root)).getPropertyValue("-webkit-line-clamp")).toBe(
      "2",
    );
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("reclamps text after font-load metrics change", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      containerStyle: "--clamp-font-size:16px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 220,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const before = textElement(root).textContent ?? "";
    mounted.container.style.setProperty("--clamp-font-size", "24px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    const after = textElement(root).textContent ?? "";
    expect(after).toContain("…");
    expect(after.length).toBeLessThan(before.length);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("recomputes clamped text conservatively after generic font-load events", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      style: "font:16px Georgia,serif;line-height:28px",
      width: 220,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const before = textElement(root).textContent;
    const records = await collectFontEventMutations(root, genericFontEvent());

    expect(records.length).toBeGreaterThan(0);
    expect(textElement(root).textContent).toBe(before);
  });

  it("ignores used font-face events when full text layout is unchanged", async () => {
    const source = "Release ownership remains visible.";
    const mounted = mountClamp({
      text: source,
      style: "font:16px Georgia,serif;line-height:28px",
      width: 560,
      props: {
        boundary: "word",
        maxLines: 3,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);

    const records = await collectFontEventMutations(root, usedFontFaceEvent());

    expect(records).toHaveLength(0);
    expect(textElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);
  });

  it("restores full text after same-width font-load metrics shrink", async () => {
    const source = "Release dashboards keep ownership visible after regional incidents.";
    const mounted = mountClamp({
      text: source,
      containerStyle: "--clamp-font-size:24px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 280,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    mounted.container.style.setProperty("--clamp-font-size", "12px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    expect(textElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);
  });

  it("does not reuse cached line results after inline font metrics shrink", async () => {
    await document.fonts?.ready;

    const source = "Release dashboards keep ownership visible after regional incidents.";
    const width = ref(280);
    const fontSize = ref(24);
    const exposed = ref<LineClampExposed | null>(null);
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(LineClamp, {
            ref: exposed,
            boundary: "word",
            maxLines: 2,
            text: source,
            style: [
              "display:block",
              `width:${width.value}px`,
              "font-family:Georgia,serif",
              `font-size:${fontSize.value}px`,
              "line-height:28px",
              "white-space:normal",
              "overflow-wrap:break-word",
            ].join(";"),
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await waitUntilVisible(root);
      await settle(4);

      width.value = 360;
      await settle(4);
      width.value = 280;
      await settle(4);

      expect(textElement(root).textContent).toContain("…");

      width.value = 360;
      await settle(4);
      fontSize.value = 12;
      width.value = 280;
      await settle(4);

      expect(textElement(root).textContent).toBe(source);
      expect(exposed.value?.clamped).toBe(false);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("uses native one-line overflow when the default end-ellipsis path is eligible", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toBe(sourceText);
    expect(getComputedStyle(textNode).textOverflow).toBe("ellipsis");
    expect(getComputedStyle(textNode).whiteSpace).toBe("nowrap");
    expect(textNode.getAttribute("aria-hidden")).toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("keeps the native one-line overflow path when location is 1", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      props: {
        maxLines: 1,
        location: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toBe(sourceText);
    expect(getComputedStyle(textNode).textOverflow).toBe("ellipsis");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("keeps the native one-line path clamped when width comes from the parent container", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      applyWidthToComponent: false,
      containerStyle: "width:120px",
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(textElement(root).textContent).toBe(sourceText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("keeps the native one-line path with fixed-width before and after slots", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      width: 180,
      props: {
        maxLines: 1,
      },
      before: () => h("strong", "Before"),
      after: () => h("button", { type: "button" }, "After"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toBe(sourceText);
    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(afterElement(root)?.textContent).toBe("After");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("allows before slot content in native multiline line-clamp mode", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 210,
      props: {
        maxLines: 2,
      },
      before: () => h("strong", "Before"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle();

    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(textElement(root).textContent).toBe(DEMO_TEXT);
    expect(getComputedStyle(lineContentElement(root)).getPropertyValue("-webkit-line-clamp")).toBe(
      "2",
    );
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("does not report native multiline clamping from a zero-width content box", async () => {
    const style = document.createElement("style");
    style.textContent = [
      ".native-zero-content[data-part='root']{padding-inline:24px}",
      ".native-zero-content [data-part='content']{width:0!important;max-width:0!important}",
    ].join("\n");
    document.head.append(style);

    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 210,
      props: {
        class: "native-zero-content",
        maxLines: 2,
      },
    });

    try {
      const root = rootElement(mounted.container);
      await waitUntilVisible(root);
      await settle();

      expect(root.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(lineContentElement(root).clientWidth).toBe(0);
      expect(textElement(root).textContent).toBe(DEMO_TEXT);
      expect(accessibleTextElement(root)).toBeNull();
      expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);

      mounted.width.value = 240;
      await settle();

      expect(root.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(lineContentElement(root).clientWidth).toBe(0);
      expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
    } finally {
      style.remove();
    }
  });

  it("keeps multiline after slot cases on the measured path", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 210,
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "After"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const textNode = textElement(root);
    expect(
      getComputedStyle(lineContentElement(root)).getPropertyValue("-webkit-line-clamp"),
    ).not.toBe("2");
    expect(textNode.textContent).not.toBe(DEMO_TEXT);
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleTextElement(root)?.textContent).toBe(DEMO_TEXT);
    expect(afterElement(root)?.textContent).toBe("After");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("reclamps after an after slot appears when clamped state changes", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
      },
      after: ({ clamped }) =>
        clamped ? h("span", { style: "display:inline-block;width:20px" }, "After") : null,
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle();

    expect(textElement(root).textContent).toBe("abcdefghijklmnopqrstuvwxyz");
    expect(afterElement(root)).not.toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("supports numeric ratio locations in the DOM-trimmed path", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      width: 120,
      props: {
        maxLines: 1,
        location: 0.75,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(textNode.textContent).toBe(bestBrowserFitText(root, sourceText, 1, 0.75));
    expect(accessibleTextElement(root)?.textContent).toBe(sourceText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("falls back to DOM-trimmed text for custom one-line ellipsis values", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
        ellipsis: "...",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toContain("...");
    expect(textNode.textContent).not.toBe("abcdefghijklmnopqrstuvwxyz");
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleTextElement(root)?.textContent).toBe("abcdefghijklmnopqrstuvwxyz");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("uses the measured path for one-line word-boundary clamping", async () => {
    const sourceText = "alpha beta gamma delta";
    const mounted = mountClamp({
      text: sourceText,
      width: 90,
      props: {
        maxLines: 1,
        boundary: "word",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(getComputedStyle(textNode).textOverflow).toBe("clip");
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expectEndWordBoundary(sourceText, textNode.textContent ?? "");
    expect(accessibleTextElement(root)?.textContent).toBe(sourceText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("keeps the production component within 3 visible lines at fractional widths", async () => {
    const mounted = mountClamp({
      text: "Vue is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable across layouts that change often.",
      width: 220.671875,
      style: "line-height:24px",
      props: {
        maxLines: 3,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(await sampleVisibleLineCounts(root)).toEqual([3, 3, 3]);
  });

  it("settles back within the requested line limit after a width shrink", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 360,
      style: "line-height:24px",
      props: {
        maxLines: 3,
      },
      after: () => "[Read more]",
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    mounted.width.value = 220;
    await settle(2);

    expect(await sampleVisibleLineCounts(root)).toEqual([3, 3, 3]);
  });

  it("reclamps measured text across repeated external container resizes", async () => {
    const sourceText = "Alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const mounted = mountClamp({
      text: sourceText,
      applyWidthToComponent: false,
      containerStyle: "width:128px",
      style: "line-height:20px",
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);

    mounted.container.style.width = "760px";
    await settle(4);

    expect(textElement(root).textContent).toBe(sourceText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);

    mounted.container.style.width = "128px";
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("recovers full measured text after a large width grow", async () => {
    const sourceText = "Alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const mounted = mountClamp({
      text: sourceText,
      width: 128,
      style: "line-height:20px",
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);

    mounted.width.value = 760;
    await settle(4);

    expect(textElement(root).textContent).toBe(sourceText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
    expect((await sampleVisibleLineCounts(root)).every((count) => count <= 2)).toBe(true);
  });

  it("uses the current external width when text changes in the same flush", async () => {
    const nextText = "Omega beta gamma delta epsilon zeta eta theta iota kappa";
    const mounted = mountClamp({
      text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa",
      applyWidthToComponent: false,
      containerStyle: "width:128px",
      style: "line-height:20px",
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);

    mounted.container.style.width = "760px";
    mounted.text.value = nextText;
    await settle(4);

    expect(textElement(root).textContent).toBe(nextText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("keeps updates within the requested line limit after a text swap", async () => {
    const nextText = "0123456789abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      width: 120,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    mounted.text.value = nextText;
    await settle(1);

    const textNode = textElement(root);
    expect(textNode.getAttribute("aria-label")).toBeNull();
    expect(textNode.textContent).toBe(nextText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("reclamps when maxHeight increases after mount", async () => {
    const maxHeight = ref("20px");
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(LineClamp, {
            maxHeight: maxHeight.value,
            style: [
              "display:block",
              "width:180px",
              "font:16px Georgia, serif",
              "line-height:20px",
              "white-space:normal",
              "overflow-wrap:break-word",
            ].join(";"),
            text: DEMO_TEXT,
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await waitUntilVisible(root);
      await settle(4);

      const before = textElement(root).textContent ?? "";
      expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);

      maxHeight.value = "40px";
      await settle(4);

      const after = textElement(root).textContent ?? "";
      expect(after.length).toBeGreaterThan(before.length);
      expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("keeps max-height fitting correct when candidate height moves the root", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 150,
      containerStyle: "height:160px;display:flex;align-items:center",
      style: "line-height:20px",
      props: {
        maxHeight: "40px",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const visibleText = textElement(root).textContent ?? "";
    expect(visibleText).toContain("…");
    expect(visibleText).not.toBe("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect((await sampleVisibleLineCounts(root)).every((count) => count <= 2)).toBe(true);
  });

  it("keeps after-slot correction close to the browser-fit maximum instead of over-clamping", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 373,
      style: [
        'font-family:"IBM Plex Sans","Segoe UI",sans-serif',
        "font-size:16px",
        "line-height:29.6px",
        "overflow-wrap:anywhere",
        "box-sizing:border-box",
        "border:1px solid #c7d0dc",
        "font-kerning:none",
        "font-variant-ligatures:none",
        'font-feature-settings:"kern" 0,"liga" 0,"clig" 0',
        "padding:0.9rem 1rem",
      ].join(";"),
      props: {
        maxLines: 3,
      },
      after: ({ clamped, expanded }) =>
        expanded || clamped
          ? h(
              "button",
              {
                style: [
                  "display:inline",
                  "padding:0",
                  "border:0",
                  "background:transparent",
                  "color:#2656b9",
                  "font-size:0.78rem",
                  "font-weight:500",
                  "line-height:inherit",
                  "white-space:nowrap",
                ].join(";"),
              },
              "Toggle",
            )
          : null,
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const current = textElement(root).textContent ?? "";
    const best = bestBrowserFitText(root, DEMO_TEXT, 3);

    expect((await sampleVisibleLineCounts(root)).every((count) => count <= 3)).toBe(true);
    expect(current.length).toBeGreaterThanOrEqual(best.length - 1);
  });

  it("emits the naive initial unclamped state before the settled clamp result", async () => {
    const values: boolean[] = [];
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
        onClampchange(value: boolean) {
          values.push(value);
        },
      },
    });

    await waitUntilVisible(rootElement(mounted.container));
    await settle();

    expect(values).toEqual([false, true]);
  });

  it("keeps the full source text available for assistive tech when the visible text is rewritten", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      props: {
        ellipsis: "...",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).not.toBe(sourceText);
    expect(textNode.textContent).toContain("...");
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleTextElement(root)?.textContent).toBe(sourceText);
  });

  it("updates rewritten visible and accessible text when the source text changes", async () => {
    const nextText = "Omega beta gamma delta epsilon zeta eta theta iota kappa lambda";
    const mounted = mountClamp({
      text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
      width: 170,
      props: {
        ellipsis: "...",
        maxLines: 1,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("Alpha");
    expect(accessibleTextElement(root)?.textContent).toContain("Alpha");

    mounted.text.value = nextText;
    await settle(4);

    expect(textElement(root).textContent).toContain("Omega");
    expect(textElement(root).textContent).not.toContain("Alpha");
    expect(accessibleTextElement(root)?.textContent).toBe(nextText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("replaces rewritten text structure when the source becomes empty", async () => {
    const mounted = mountClamp({
      text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
      width: 170,
      props: {
        boundary: "word",
        maxLines: 1,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect(accessibleTextElement(root)?.textContent).toContain("Alpha");

    mounted.text.value = "";
    await settle(4);

    expect(bodyElement(root).textContent).toBe("");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("replaces unclamped measured text when the source becomes empty", async () => {
    const mounted = mountClamp({
      text: "Alpha beta",
      width: 480,
      props: {
        boundary: "word",
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toBe("Alpha beta");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);

    mounted.text.value = "";
    await settle(4);

    expect(bodyElement(root).textContent).toBe("");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("replaces unclamped measured text without leaving a hidden source wrapper", async () => {
    const mounted = mountClamp({
      text: "Alpha beta",
      width: 480,
      props: {
        boundary: "word",
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    mounted.text.value = "Omega beta";
    await settle(4);

    expect(textElement(root).textContent).toBe("Omega beta");
    expect(textElement(root).getAttribute("aria-hidden")).toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("restores full inline text after a small width grow", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const textStyle = "font:16px Menlo,monospace;line-height:20px";
    const fullWidth = measuredTextWidth(sourceText, textStyle);
    const width = ref(Math.ceil(fullWidth - 8));
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(InlineClamp, {
            location: "middle",
            style: `width:${width.value}px;${textStyle}`,
            text: sourceText,
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await settle(4);

      expect(inlineBodyElement(root).textContent).not.toBe(sourceText);
      expect(inlineBodyElement(root).getAttribute("aria-hidden")).toBe("true");

      width.value = Math.ceil(fullWidth + 2);
      await settle(4);

      expect(inlineBodyElement(root).textContent).toBe(sourceText);
      expect(inlineBodyElement(root).getAttribute("aria-hidden")).toBeNull();
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("keeps the rich root ellipsis when reclamping from a trimmed root text cut", () => {
    const prepared = prepareRich("<span></span> abc");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = null;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );
    expect(target.textContent).toBe("…");

    patchRich(prepared, target, state, { kind: "clamped", point: { path: [1], offset: 2 } }, "…");

    expect([...target.childNodes].map((node) => node.textContent)).toEqual(["", " a", "…"]);
  });

  it("preserves rich text nodes when reclamping to a same-node whitespace cut", async () => {
    const prepared = prepareRich("<span>alpha beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const span = target.firstChild;
    const text = span?.firstChild;
    const ellipsisNode = target.lastChild;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((nextRecords) => {
      records.push(...nextRecords);
    });

    observer.observe(target, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [0, 0], offset: 6 } },
      "…",
    );
    await Promise.resolve();
    observer.disconnect();

    expect(target.textContent).toBe("alpha…");
    expect(target.firstChild).toBe(span);
    expect(target.firstChild?.firstChild).toBe(text);
    expect(target.lastChild).toBe(ellipsisNode);
    expect(records).toHaveLength(0);
  });

  it("calibrates same-state rich patches as mutation-free", async () => {
    const prepared = prepareRich("<span>alpha beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    const nextState: RichState = { kind: "clamped", point: { path: [0, 0], offset: 5 } };
    let state: RichState | null = patchRich(prepared, target, null, nextState, "…");
    const summary = await observeMutationsDuring(target, () => {
      state = patchRich(prepared, target, state, nextState, "…");
    });

    expect(target.textContent).toBe("alpha…");
    expect(summary.records).toBe(0);
  });

  it("calibrates same-text rich cuts as character-data work", async () => {
    const prepared = prepareRich("<span>alpha beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 2 } },
      "…",
    );
    const span = target.firstChild;
    const text = span?.firstChild;
    const ellipsisNode = target.lastChild;
    const summary = await observeMutationsDuring(target, () => {
      state = patchRich(
        prepared,
        target,
        state,
        { kind: "clamped", point: { path: [0, 0], offset: 3 } },
        "…",
      );
    });

    expect(target.textContent).toBe("alp…");
    expect(target.firstChild).toBe(span);
    expect(target.firstChild?.firstChild).toBe(text);
    expect(target.lastChild).toBe(ellipsisNode);
    expect(summary.characterData).toBeGreaterThan(0);
    expect(summary.childList).toBe(0);
    expect(summary.addedNodes).toBe(0);
    expect(summary.removedNodes).toBe(0);
  });

  it("calibrates whole-prefix rich growth as child-list work", async () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;
    const summary = await observeMutationsDuring(target, () => {
      state = patchRich(
        prepared,
        target,
        state,
        { kind: "clamped", point: { path: [2, 0], offset: 4 } },
        "…",
      );
    });

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
    expect(summary.childList).toBeGreaterThan(0);
    expect(summary.addedNodes).toBeGreaterThan(0);
  });

  it("calibrates full-to-clamped rich patches as child-list work", async () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(prepared, target, null, { kind: "full" }, "…");
    const firstSpan = target.firstChild;
    const summary = await observeMutationsDuring(target, () => {
      state = patchRich(
        prepared,
        target,
        state,
        { kind: "clamped", point: { path: [2, 0], offset: 2 } },
        "…",
      );
    });

    expect(target.textContent).toBe("alpha be…");
    expect(target.firstChild).toBe(firstSpan);
    expect(summary.childList).toBeGreaterThan(0);
    expect(summary.removedNodes).toBeGreaterThan(0);
  });

  it("matches declared rich patch classes to observed DOM mutation vectors", async () => {
    const cases: {
      expected: RichPatchClass;
      from: RichState;
      html: string;
      to: RichState;
    }[] = [
      {
        expected: "same-state",
        from: { kind: "clamped", point: { path: [0, 0], offset: 5 } },
        html: "<span>alpha beta</span>",
        to: { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      },
      {
        expected: "same-text-cut",
        from: { kind: "clamped", point: { path: [0, 0], offset: 2 } },
        html: "<span>alpha beta</span>",
        to: { kind: "clamped", point: { path: [0, 0], offset: 3 } },
      },
      {
        expected: "whole-prefix",
        from: { kind: "clamped", point: { path: [0, 0], offset: 5 } },
        html: "<span>alpha</span> <span>beta</span> <span>gamma</span>",
        to: { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      },
      {
        expected: "full-to-clamped",
        from: { kind: "full" },
        html: "<span>alpha</span> <span>beta</span> <span>gamma</span>",
        to: { kind: "clamped", point: { path: [2, 0], offset: 2 } },
      },
      {
        expected: "clamped-to-full",
        from: { kind: "clamped", point: { path: [0, 0], offset: 5 } },
        html: "<span>alpha</span> <span>beta</span> <span>gamma</span>",
        to: { kind: "full" },
      },
    ];

    for (const { expected, from, html, to } of cases) {
      const prepared = prepareRich(html);
      if (!prepared) {
        throw new Error("Expected rich preparation to be available.");
      }

      const target = document.createElement("span");
      let state: RichState | null = patchRich(prepared, target, null, from, "…");
      const costClass = richPatchClass(from, to);

      expect(costClass).toBe(expected);

      const summary = await observeMutationsDuring(target, () => {
        state = patchRich(prepared, target, state, to, "…");
      });

      expectObservedRichPatchCostClass(summary, costClass);
    }
  });

  it("preserves the rich root ellipsis across generic clamped patches", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 2 } },
      "…",
    );
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 2 } },
      "…",
    );

    expect(target.textContent).toBe("alpha be…");
    expect(target.lastChild).toBe(ellipsisNode);
    expect(state.kind).toBe("clamped");
  });

  it("preserves complete rich prefix nodes when growing across sibling text wrappers", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("preserves rich prefix nodes when growing from a partial text cut", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 2 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const firstText = firstSpan?.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.firstChild?.firstChild).toBe(firstText);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("preserves rich prefix nodes when clamping from full rich content", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(prepared, target, null, { kind: "full" }, "…");
    const firstSpan = target.childNodes[0];
    const rootSpace = target.childNodes[1];
    const secondSpan = target.childNodes[2];
    const secondText = secondSpan?.firstChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 2 } },
      "…",
    );

    expect(target.textContent).toBe("alpha be…");
    expect(target.childNodes[0]).toBe(firstSpan);
    expect(target.childNodes[1]).toBe(rootSpace);
    expect(target.childNodes[2]).toBe(secondSpan);
    expect(target.childNodes[2]?.firstChild).toBe(secondText);
  });

  it("preserves complete rich prefix nodes when growing to full rich content", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;

    state = patchRich(prepared, target, state, { kind: "full" }, "…");

    expect(target.textContent).toBe("alpha beta gamma");
    expect(target.firstChild).toBe(firstSpan);
  });

  it("restores trimmed rich prefix whitespace when growing across sibling wrappers", () => {
    const prepared = prepareRich("<span>alpha </span><span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 6 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [1, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
  });

  it("preserves complete rich prefix nodes when growing from a trimmed root space", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("preserves complete rich prefix nodes when shrinking to a trimmed root space", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("rebuilds rich content when a trimmed root space hides inner prefix whitespace", () => {
    const prepared = prepareRich("<span>alpha </span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");

    state = patchRich(prepared, target, state, { kind: "full" }, "…");

    expect(target.innerHTML).toBe("<span>alpha </span> <span>beta</span>");
    expect(state.kind).toBe("full");
  });

  it("preserves complete rich prefix nodes when shrinking across sibling text wrappers", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [2, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("uses native multiline clamping for eligible rich html", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.innerHTML).toContain("<strong>Vue</strong>");
    expect(rich.innerHTML).toContain('<a href="/docs">');
    expect(rich.querySelector("img")).toBeInstanceOf(HTMLImageElement);
    expect(rich.textContent).not.toContain("…");
    expect(rich.getAttribute("aria-hidden")).toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect(rich.parentElement?.style.webkitLineClamp).toBe("2");
    expect(root.querySelector('[aria-hidden="true"]')).toBeNull();
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("does not parse rich html while native clamping can preserve the authored DOM", async () => {
    const sourceHtml = ref("<strong>Alpha beta</strong> gamma delta epsilon zeta eta theta");
    const boundary = ref<"grapheme" | "word">("grapheme");
    const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString");
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(RichLineClamp, {
            boundary: boundary.value,
            html: sourceHtml.value,
            maxLines: 2,
            style: "display:block;width:120px;font:16px Menlo,monospace;line-height:20px",
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      await waitUntilVisible(rootElement(container));
      await settle(4);
      expect(parseSpy).not.toHaveBeenCalled();

      sourceHtml.value = "<em>One two</em> three four five six seven eight nine ten";
      await settle(4);
      expect(parseSpy).not.toHaveBeenCalled();

      boundary.value = "word";
      await settle(4);
      expect(parseSpy).toHaveBeenCalledOnce();
    } finally {
      app.unmount();
      container.remove();
      parseSpy.mockRestore();
    }
  });

  it("uses native single-line clamping with a rich after slot", async () => {
    const sourceHtml = "<strong>Alpha beta</strong> gamma delta epsilon zeta eta theta";
    const mounted = mountRichClamp({
      after: () => h("button", { type: "button" }, "More"),
      html: sourceHtml,
      width: 150,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.innerHTML).toBe(sourceHtml);
    expect(rich.style.textOverflow).toBe("ellipsis");
    expect(rich.parentElement?.style.display).toBe("inline-flex");
    expect(root.querySelector('[aria-hidden="true"]')).toBeNull();
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("uses native rich clamping without connecting a custom-element clone", async () => {
    const tagName = "vue-clamp-native-lifecycle-source";
    let connectedCount = 0;

    customElements.define(
      tagName,
      class extends HTMLElement {
        connectedCallback(): void {
          connectedCount += 1;
        }
      },
    );

    const sourceHtml = `<${tagName}>Alpha beta gamma delta epsilon zeta eta theta iota kappa</${tagName}>`;
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 100,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(connectedCount).toBe(1);
    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect(root.querySelector('[aria-hidden="true"]')).toBeNull();
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("restores full rich DOM when switching from measured to native clamping", async () => {
    const sourceHtml = "<strong>Alpha beta</strong> gamma delta epsilon zeta eta theta";
    const boundary = ref<"grapheme" | "word">("word");
    const exposed = ref<RichLineClampExposed | null>(null);
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(RichLineClamp, {
            ref: exposed,
            boundary: boundary.value,
            html: sourceHtml,
            maxLines: 2,
            style: "display:block;width:120px;font:16px Menlo,monospace;line-height:20px",
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await waitUntilVisible(root);
      await settle(4);

      expect(richContentElement(root).textContent).toContain("…");
      expect(root.querySelector('[aria-hidden="true"]')).toBeInstanceOf(HTMLElement);

      boundary.value = "grapheme";
      await settle(4);

      expect(richContentElement(root).innerHTML).toBe(sourceHtml);
      expect(root.querySelector('[aria-hidden="true"]')).toBeNull();
      expect(exposed.value?.clamped).toBe(true);

      boundary.value = "word";
      await settle(4);

      expect(richContentElement(root).textContent).toContain("…");
      expect(root.querySelector('[aria-hidden="true"]')).toBeInstanceOf(HTMLElement);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("reclamps rich html after font-load metrics change", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      containerStyle: "--clamp-font-size:16px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 220,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const before = richContentElement(root).textContent ?? "";
    mounted.container.style.setProperty("--clamp-font-size", "24px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    const after = richContentElement(root).textContent ?? "";
    expect(after).toContain("…");
    expect(after.length).toBeLessThan(before.length);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("recomputes clamped rich html conservatively after generic font-load events", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      style: "font:16px Georgia,serif;line-height:28px",
      width: 220,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const before = richContentElement(root).innerHTML;
    const records = await collectFontEventMutations(root, genericFontEvent());

    expect(records.length).toBeGreaterThan(0);
    expect(richContentElement(root).innerHTML).toBe(before);
  });

  it("ignores used font-face events when full rich layout is unchanged", async () => {
    const source = "Release ownership remains visible.";
    const html = "<strong>Release ownership</strong> remains visible.";
    const mounted = mountRichClamp({
      html,
      style: "font:16px Georgia,serif;line-height:28px",
      width: 560,
      props: {
        boundary: "word",
        maxLines: 3,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);

    const before = richContentElement(root).innerHTML;
    const records = await collectFontEventMutations(root, usedFontFaceEvent());

    expect(records).toHaveLength(0);
    expect(richContentElement(root).innerHTML).toBe(before);
    expect(mounted.exposed.value?.clamped).toBe(false);
  });

  it("restores full rich html after same-width font-load metrics shrink", async () => {
    const source = "Release dashboards keep ownership visible after regional incidents.";
    const html =
      "<strong>Release dashboards</strong> keep ownership visible after <em>regional incidents</em>.";
    const mounted = mountRichClamp({
      html,
      containerStyle: "--clamp-font-size:24px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 280,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    mounted.container.style.setProperty("--clamp-font-size", "12px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    expect(richContentElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);
  });

  for (const surface of ["line", "rich"] as const) {
    it(`rechecks inherited text metrics at repeated widths for ${surface} content`, async () => {
      const source = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
      const style = document.createElement("style");
      style.textContent = '[data-clamp-spacing="wide"] { letter-spacing: 3px; }';
      document.head.append(style);

      const mounted =
        surface === "line"
          ? mountClamp({
              props: {
                ellipsis: "...",
                maxLines: 1,
              },
              style: "letter-spacing:inherit",
              text: source,
              width: 120,
            })
          : mountRichClamp({
              html: source,
              props: {
                ellipsis: "...",
                maxLines: 1,
              },
              style: "letter-spacing:inherit",
              width: 120,
            });

      try {
        const root = rootElement(mounted.container);
        const visibleText = () =>
          surface === "line"
            ? (textElement(root).textContent ?? "")
            : (richContentElement(root).textContent ?? "");

        await waitUntilVisible(root);
        await settle(4);
        mounted.width.value = 320;
        await settle(4);
        mounted.width.value = 120;
        await settle(4);

        const compact = visibleText();
        expect(compact).toContain("...");
        expect(compact).not.toBe(source);

        mounted.width.value = 320;
        await settle(4);
        mounted.container.dataset.clampSpacing = "wide";
        mounted.width.value = 120;
        await settle(4);

        const spaced = visibleText();
        expect(spaced).toContain("...");
        expect(spaced.length).toBeLessThan(compact.length);
        expect(visibleLineCount(root)).toBe(1);
      } finally {
        style.remove();
      }
    });
  }

  it("recomputes rich content after root style changes at a repeated width", async () => {
    const source = "Release dashboards keep ownership visible after regional incidents.";
    const html =
      "<strong>Release dashboards</strong> keep ownership visible after <em>regional incidents</em>.";
    const width = ref(280);
    const fontSize = ref(24);
    const exposed = ref<RichLineClampExposed | null>(null);
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(RichLineClamp, {
            ref: exposed,
            boundary: "word",
            html,
            maxLines: 2,
            style: [
              "display:block",
              `width:${width.value}px`,
              "font-family:Georgia,serif",
              `font-size:${fontSize.value}px`,
              "line-height:28px",
              "overflow-wrap:break-word",
            ].join(";"),
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await waitUntilVisible(root);
      await settle(4);

      width.value = 360;
      await settle(4);
      width.value = 280;
      await settle(4);

      expect(richContentElement(root).textContent).toContain("…");

      width.value = 360;
      await settle(4);
      fontSize.value = 12;
      width.value = 280;
      await settle(4);

      expect(richContentElement(root).textContent).toBe(source);
      expect(exposed.value?.clamped).toBe(false);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("keeps supported rich html within the line limit at fractional widths", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      width: 170.671875,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(
      Number.parseFloat((root.lastElementChild as HTMLElement | null)?.style.width ?? ""),
    ).toBeCloseTo(170.671875, 3);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("recovers full rich html after a small width grow from a clamped state", async () => {
    const sourceText = "Alpha beta gamma delta epsilon zeta";
    const sourceHtml = "<strong>Alpha beta</strong> gamma delta epsilon zeta";
    const textStyle = "font:16px Menlo,monospace;line-height:20px";
    const twoLineFitWidth = measuredTextWidth(sourceText, textStyle) / 2;
    const mounted = mountRichClamp({
      html: sourceHtml,
      style: textStyle,
      width: Math.floor(twoLineFitWidth - 16),
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);

    mounted.width.value = Math.ceil(twoLineFitWidth + 48);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("uses the current external width when rich html changes in the same flush", async () => {
    const nextHtml = "<strong>Omega beta</strong> gamma delta epsilon zeta eta theta";
    const mounted = mountRichClamp({
      html: "<strong>Alpha beta</strong> gamma delta epsilon zeta eta theta",
      applyWidthToComponent: false,
      containerStyle: "width:128px",
      style: "font:16px Menlo,monospace;line-height:20px",
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);

    mounted.container.style.width = "760px";
    mounted.html.value = nextHtml;
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(nextHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("reclamps rich html when an affix wrapper keeps identity but changes size", async () => {
    const afterWidth = ref(20);
    const mounted = mountRichClamp({
      after: () =>
        h("span", {
          style: `display:inline-block;width:${afterWidth.value}px`,
        }),
      html: RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const initialText = richContentElement(root).textContent ?? "";
    expect(initialText).toContain("…");
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);

    afterWidth.value = 120;
    await settle(8);

    const renderedAfter = afterElement(root)?.firstElementChild as HTMLElement | null;
    expect(renderedAfter?.getBoundingClientRect().width).toBeCloseTo(120, 3);
    expect(richContentElement(root).textContent?.length ?? 0).toBeLessThan(initialText.length);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("replaces clamped rich html when the source changes to a fitting value", async () => {
    const shortHtml = "<em>Short rich text</em>";
    const mounted = mountRichClamp({
      html: "<strong>Alpha beta gamma delta epsilon zeta eta theta iota kappa</strong>",
      width: 130,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);

    mounted.html.value = shortHtml;
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(shortHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
  });

  it("can clamp supported rich text at word boundaries", async () => {
    const sourceText = "Alpha beta gamma delta epsilon";
    const mounted = mountRichClamp({
      html: `<strong>Alpha</strong> beta gamma delta epsilon`,
      width: 115,
      props: {
        maxLines: 1,
        boundary: "word",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector("strong")).toBeInstanceOf(HTMLElement);
    expectEndWordBoundary(sourceText, rich.textContent ?? "");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("places the rich ellipsis outside the inline element that contains the cut", async () => {
    const mounted = mountRichClamp({
      html: "<code>release-candidate-build-number-2026</code> trailing copy",
      width: 150,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    const code = rich.querySelector("code");
    if (!(code instanceof HTMLElement)) {
      throw new Error("Expected retained code element.");
    }

    expect(code.textContent).not.toContain("…");
    expect(rich.lastChild).toBeInstanceOf(Text);
    expect(rich.lastChild?.textContent).toBe("…");
    expect(rich.innerHTML).toMatch(/^<code>.+<\/code>…$/u);

    mounted.width.value = 130;
    await settle(4);

    const rootEllipses = [...rich.childNodes].filter(
      (node) => node instanceof Text && node.data === "…",
    );
    expect(rootEllipses).toHaveLength(1);
    expect(rich.querySelector("code")?.textContent).not.toContain("…");
  });

  it("preserves visible rich images across same-html width reclamps", async () => {
    const mounted = mountRichClamp({
      html: REMOTE_IMAGE_RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await settle(4);

    const firstImage = richImage(root, "Expected the initial rich image.");

    mounted.width.value = 171;
    await settle(4);

    const secondImage = richImage(root, "Expected the current rich image.");
    expect(secondImage).toBe(firstImage);
    expect(secondImage.getAttribute("src")).toBe("/rich-demo-icon.svg");

    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("uses inert image sources in the hidden rich probe", async () => {
    const mounted = mountRichClamp({
      html: REMOTE_IMAGE_RICH_TEXT_HTML,
      width: 170,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await settle(4);

    expect(richImage(root, "Expected the visible rich image.").getAttribute("src")).toBe(
      "/rich-demo-icon.svg",
    );

    const probeImage = root.querySelector('[aria-hidden="true"] img');
    if (!(probeImage instanceof HTMLImageElement)) {
      throw new Error("Expected the hidden rich probe image.");
    }

    expect(probeImage.getAttribute("src")).toMatch(/^data:image\//u);
  });

  it("clamps behavior-supported inline wrappers regardless of tag name", async () => {
    const mounted = mountRichClamp({
      html: BEHAVIORAL_RICH_TEXT_HTML,
      width: 170,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector("div")).toBeInstanceOf(HTMLDivElement);
    expect(rich.querySelector("section")).toBeInstanceOf(HTMLElement);
    expect(rich.textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("applies public rich body styling hooks inside the measured probe", async () => {
    const style = document.createElement("style");
    style.textContent =
      '.structural-rich [data-part="body"] .structural-token{display:inline-block;width:180px}';
    document.head.append(style);

    const mounted = mountRichClamp({
      html: '<span class="structural-token">observabilityPlatform1</span> trailing copy',
      width: 120,
      props: {
        boundary: "word",
        class: "structural-rich",
        maxLines: 1,
      },
    });

    try {
      const root = rootElement(mounted.container);
      await waitUntilVisible(root);
      await settle(4);

      expect(richContentElement(root).textContent).toBe("…");
      expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
      expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
    } finally {
      style.remove();
    }
  });

  it("clamps empty inline boxes as atomic inline content", async () => {
    const mounted = mountRichClamp({
      html: ATOMIC_LEAF_RICH_TEXT_HTML,
      width: 120,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector("span")).toBeInstanceOf(HTMLElement);
    expect(rich.textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("leaves custom elements unclamped without connecting a hidden clone", async () => {
    const tagName = "vue-clamp-probe-lifecycle-source";
    let connectedCount = 0;

    customElements.define(
      tagName,
      class extends HTMLElement {
        connectedCallback(): void {
          connectedCount += 1;
        }
      },
    );

    const sourceHtml = `<${tagName}>Lifecycle content</${tagName}> with trailing text that spans multiple lines.`;
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 110,
      props: {
        maxHeight: 20,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(connectedCount).toBe(1);
    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect(root.querySelector(`[aria-hidden="true"] ${tagName}`)).toBeNull();
    expect((root.querySelector('[aria-hidden="true"]') as HTMLElement | null)?.inert).toBe(true);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(root.style.maxHeight).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("leaves custom affixes unclamped without connecting a hidden clone", async () => {
    const tagName = "vue-clamp-probe-lifecycle-affix";
    let connectedCount = 0;

    customElements.define(
      tagName,
      class extends HTMLElement {
        connectedCallback(): void {
          connectedCount += 1;
        }
      },
    );

    const sourceHtml = "Alpha beta gamma delta epsilon zeta eta theta";
    const mounted = mountRichClamp({
      after: ({ clamped }) => (clamped ? h(tagName, null, "More") : null),
      html: sourceHtml,
      width: 110,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(connectedCount).toBe(1);
    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect(root.querySelector(`[aria-hidden="true"] ${tagName}`)).toBeNull();
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
  });

  it("leaves duplicate document identities unclamped", async () => {
    const sourceHtml = '<span id="rich-identity">Alpha beta gamma delta epsilon zeta</span>';
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 110,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect(root.querySelectorAll("#rich-identity")).toHaveLength(1);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
  });

  it.each([
    ["form controls", '<input name="probe-value" value="Alpha beta gamma" />'],
    ["inline event handlers", '<span onclick="void 0">Alpha beta gamma delta</span>'],
    ["embedded documents", '<iframe srcdoc="Alpha beta gamma delta"></iframe>'],
  ])("leaves %s out of the connected probe", async (_label, sourceHtml) => {
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 80,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).childElementCount).toBe(1);
    expect(root.querySelector('[aria-hidden="true"]')?.childElementCount).toBe(0);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
  });

  it("treats inline-block descendants as atomic runs", async () => {
    const mounted = mountRichClamp({
      html: INLINE_BLOCK_RICH_TEXT_HTML,
      width: 90,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector(".inline-box")).toBeNull();
    expect(rich.textContent).toContain("Lead");
    expect(rich.textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("marks class-styled atomic whitespace rich cuts as unsafe warm ranks", async () => {
    const html =
      '<span class="rich-atomic-token">A</span> <span class="rich-atomic-token">B</span> trailing rich copy';
    const fixture = createRichClampFixture({
      html,
      styles: [
        ".rich-atomic-token{display:inline-block;width:36px;height:12px;vertical-align:baseline}",
      ],
      width: 44,
    });

    try {
      await settle(1);
      const result = fixture.clamp();

      expect(result.state?.kind).toBe("clamped");
      expect(result.textRankSafe).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("does not publish a word rank for rich fallback grapheme cuts", async () => {
    const html = "supercalifragilisticexpialidocious";
    const fixture = createRichClampFixture({ html, width: 44 });

    try {
      await settle(1);
      const result = fixture.clamp();

      expect(result.state?.kind).toBe("clamped");
      expect(result.rank).toBeUndefined();
      expect(result.textRankSafe).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("revalidates full rich layout before reusing simple-line calibration", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      let result: RichClampResult | undefined;
      const firstCalls = countClientRectsDuring(content, () => {
        result = clampRich({
          ellipsis: "…",
          from: null,
          hint: null,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
        });
      });

      const first = result;
      const searchIndex = first?.searchIndex;
      if (!first || !searchIndex) {
        throw new Error("Expected rich clamp to return a calibrated search index.");
      }

      const secondCalls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          searchIndex,
        });
      });

      expect(firstCalls).toBeGreaterThan(0);
      expect(secondCalls).toBe(1);
    } finally {
      container.remove();
    }
  });

  it("keeps exact rich rect-list counting when font boxes can exceed line height", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font-family:Georgia, serif",
      "font-size:18px",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: null,
          hint: null,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
        });
      });

      expect(calls).toBeGreaterThan(0);
    } finally {
      container.remove();
    }
  });

  it("captures rich search probe costs during actual layout fitting", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 8 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const fixture = createRichClampFixture({
      html,
      rootStyle: ["font-size:18px"],
      width: 160,
    });

    try {
      await settle(1);
      let result: RichClampResult | undefined;
      const samples = await collectRichProbeCostsDuring(fixture.content, fixture.body, () => {
        result = fixture.clamp();
      });
      const patchKinds = samples.map(richProbePatchKind);

      expect(result?.state?.kind).toBe("clamped");
      expect(samples.length).toBeGreaterThan(1);
      expect(
        samples.every((sample) => sample.boundingRectReads + sample.clientRectReads === 1),
      ).toBe(true);
      expect(samples.some((sample) => sample.clientRectEntries > 0)).toBe(true);
      expect(samples.some((sample) => sample.boundingRectReads > 0)).toBe(true);
      expect(samples.some((sample) => sample.styleReads > 0)).toBe(true);
      expect(samples.some((sample) => sample.cloneCalls > 0)).toBe(true);
      expect(samples.some((sample) => sample.mutations.records > 0)).toBe(true);
      expect(
        samples.some(
          (sample) => sample.mutations.childList > 0 || sample.mutations.characterData > 0,
        ),
      ).toBe(true);
      expect(patchKinds).toContain("structure");
    } finally {
      fixture.cleanup();
    }
  });

  it("captures same-text rich probe costs during actual layout fitting", async () => {
    const html = `<span>${[
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      "eta",
      "theta",
      "iota",
      "kappa",
      "lambda",
    ].join(" ")}</span>`;
    const fixture = createRichClampFixture({
      html,
      rootStyle: ["font-size:18px"],
      width: 120,
    });

    try {
      await settle(1);
      let result: RichClampResult | undefined;
      const samples = await collectRichProbeCostsDuring(fixture.content, fixture.body, () => {
        result = fixture.clamp();
      });
      const patchKinds = samples.map(richProbePatchKind);

      expect(result?.state?.kind).toBe("clamped");
      expect(samples.length).toBeGreaterThan(1);
      expect(patchKinds).toContain("text");
      expect(
        samples.some(
          (sample) => sample.mutations.characterData > 0 && sample.mutations.childList === 0,
        ),
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("seeds a cold rich search from physical lines across inline fragments", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 28 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const fixture = createRichClampFixture({
      html,
      lineLimit: 2,
      rootStyle: ["font-size:18px"],
      width: 560,
    });

    try {
      await settle(1);
      const samples = await collectRichProbeCostsDuring(fixture.content, fixture.body, () => {
        fixture.clamp();
      });

      expect(samples.length).toBeLessThanOrEqual(9);
    } finally {
      fixture.cleanup();
    }
  });

  it("compares rich warm and cold patch cost vectors during actual layout fitting", async () => {
    const html = `Telemetry ${Array.from(
      { length: 8 },
      (_, index) => `observabilityPlatform${index + 1}`,
    ).join(" ")}`;
    const comparison = await compareRichWarmColdCosts({
      html,
      nextWidth: 150,
      previousWidth: 160,
      rootStyle: ["font-size:18px"],
    });

    expectWarmPatchCreditDirection(comparison);
  });

  it("compares rich warm and cold patch vectors for hinted text-run fitting", async () => {
    const comparison = await compareRichWarmColdCosts({
      html: [
        "alpha",
        "beta",
        "gamma",
        "delta",
        "epsilon",
        "zeta",
        "eta",
        "theta",
        "iota",
        "kappa",
        "lambda",
        "mu",
      ].join(" "),
      nextWidth: 110,
      previousWidth: 120,
      rootStyle: ["font-size:18px"],
    });

    expectWarmPatchCreditDirection(comparison);
  });

  it("compares rich warm and cold patch vectors across atomic runs", async () => {
    const comparison = await compareRichWarmColdCosts({
      html: `Lead <span style="display:inline-block;width:44px;height:14px;vertical-align:baseline"></span> ${Array.from(
        { length: 8 },
        (_, index) => `observabilityPlatform${index + 1}`,
      ).join(" ")}`,
      nextWidth: 150,
      previousWidth: 170,
      rootStyle: ["font-size:18px"],
    });

    expectWarmPatchCreditDirection(comparison);
  });

  it("compares rich warm and cold patch vectors with affix occupancy", async () => {
    const comparison = await compareRichWarmColdCosts({
      affixWidths: [36, 28],
      html: `<strong>Telemetry</strong> ${Array.from(
        { length: 7 },
        (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
      ).join(" ")}`,
      nextWidth: 170,
      previousWidth: 190,
      rootStyle: ["font-size:18px"],
    });

    expectWarmPatchCreditDirection(comparison, false);
    if (comparison.decision === null) {
      expect(comparison.decisionReason).toBe("target-unranked");
    } else {
      expect(comparison.decisionReason).toBeNull();
    }
    expect(comparison.mixedDecision).not.toBeNull();
    expect(comparison.mixedDecisionReason).toBeNull();
  });

  it("compares rich warm and cold patch vectors under max-height fitting", async () => {
    const comparison = await compareRichWarmColdCosts({
      html: `Telemetry ${Array.from(
        { length: 12 },
        (_, index) => `observabilityPlatform${index + 1}`,
      ).join(" ")}`,
      maxHeight: "40px",
      nextWidth: 190,
      previousWidth: 220,
      rootStyle: ["font-size:18px"],
    });

    expectWarmPatchCreditDirection(comparison);
  });

  it("observes Rich target-rank movement from line count and boundary density", async () => {
    const denseHtml = `<span>${Array.from({ length: 56 }, (_, index) => `metric${index + 1}`).join(
      " ",
    )}</span>`;
    const longTokenHtml = `<span>${Array.from(
      { length: 56 },
      (_, index) => `observabilityPlatform${index + 1}`,
    ).join(" ")}</span>`;

    const denseOneLine = await richRankForLayout({
      html: denseHtml,
      lineLimit: 1,
      width: 160,
    });
    const denseThreeLines = await richRankForLayout({
      html: denseHtml,
      lineLimit: 3,
      width: 160,
    });
    const denseWide = await richRankForLayout({
      html: denseHtml,
      lineLimit: 3,
      width: 240,
    });
    const longNarrow = await richRankForLayout({
      html: longTokenHtml,
      lineLimit: 3,
      width: 160,
    });
    const longWide = await richRankForLayout({
      html: longTokenHtml,
      lineLimit: 3,
      width: 240,
    });

    expect(denseThreeLines).toBeGreaterThan(denseOneLine);
    expect(denseWide - denseThreeLines).toBeGreaterThan(longWide - longNarrow);
  });

  it("calibrates fallback-aware Rich mixed rank on held-out layout inputs", async () => {
    const longTokenHtml = "<span>observabilityPlatformTelemetryPipeline</span>";
    const longNarrow = await richMixedRankForLayout({
      html: longTokenHtml,
      rootStyle: ["font-size:18px"],
      width: 110,
    });
    const longWide = await richMixedRankForLayout({
      html: longTokenHtml,
      rootStyle: ["font-size:18px"],
      width: 170,
    });

    expect(longNarrow.publishedRank).toBeUndefined();
    expect(longNarrow.rank).toBeGreaterThan(0);
    expect(longWide.rank).toBeGreaterThan(longNarrow.rank);

    const plain = await richMixedRankForLayout({
      html: longTokenHtml,
      rootStyle: ["font-size:18px"],
      width: 170,
    });
    const affixed = await richMixedRankForLayout({
      affixWidths: [36, 28],
      html: longTokenHtml,
      rootStyle: ["font-size:18px"],
      width: 170,
    });

    expect(plain.rank).toBeGreaterThan(affixed.rank);

    const cjkEmojiHtml = "<span>指标🙂测量指标🙂测量指标🙂测量指标🙂测量</span>";
    const cjkNarrow = await richMixedRankForLayout({
      html: cjkEmojiHtml,
      rootStyle: ["font-size:18px"],
      width: 100,
    });
    const cjkWide = await richMixedRankForLayout({
      html: cjkEmojiHtml,
      rootStyle: ["font-size:18px"],
      width: 160,
    });

    expect(cjkWide.rank).toBeGreaterThan(cjkNarrow.rank);

    const oneLine = await richMixedRankForLayout({
      html: longTokenHtml,
      lineLimit: 1,
      rootStyle: ["font-size:18px"],
      width: 110,
    });
    const threeLines = await richMixedRankForLayout({
      html: longTokenHtml,
      lineLimit: 3,
      rootStyle: ["font-size:18px"],
      width: 110,
    });

    expect(threeLines.rank).toBeGreaterThan(oneLine.rank);

    const clippedHtml = `<span>${Array.from(
      { length: 24 },
      (_, index) => `metric${index + 1}`,
    ).join(" ")}</span>`;
    const shortClip = await richMixedRankForLayout({
      html: clippedHtml,
      maxHeight: "40px",
      rootStyle: ["font-size:18px", "line-height:28px"],
      width: 220,
    });
    const tallClip = await richMixedRankForLayout({
      html: clippedHtml,
      maxHeight: "80px",
      rootStyle: ["font-size:18px", "line-height:28px"],
      width: 220,
    });

    expect(shortClip.textRankSafe).toBe(true);
    expect(tallClip.rank).toBeGreaterThan(shortClip.rank);

    const atomicOnly = await richMixedRankForLayout({
      html: `<span style="display:inline-block;width:44px;height:14px;vertical-align:baseline"></span> observabilityPlatformTelemetryPipeline`,
      rootStyle: ["font-size:18px"],
      width: 70,
    });

    expect(atomicOnly.textRankSafe).toBe(false);
  });

  it("keeps tight max-height clipping outside mixed-rank slope inputs", async () => {
    const longTokenHtml = "<span>observabilityPlatformTelemetryPipeline</span>";
    const tightStyle = ["font-size:18px", "line-height:28px"];
    const narrow = await richMixedRankForLayout({
      html: longTokenHtml,
      maxHeight: "10px",
      rootStyle: tightStyle,
      width: 120,
    });
    const wide = await richMixedRankForLayout({
      html: longTokenHtml,
      maxHeight: "10px",
      rootStyle: tightStyle,
      width: 240,
    });

    expect(narrow.rank).toBe(0);
    expect(wide.rank).toBe(0);
    expect(narrow.textRankSafe).toBe(false);
    expect(wide.textRankSafe).toBe(false);
  });

  it("bounds fallback-aware Rich mixed-rank movement with physical width inputs", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const longTokenHtml = `<span>${longToken}</span>`;
    const longTokenInterval = await expectRichMixedRankInterval({
      html: longTokenHtml,
      lineCapacity: 1,
      nextWidth: 170,
      previousWidth: 110,
      rootStyle: ["font-size:18px"],
      text: longToken,
    });

    expect(longTokenInterval.interval.max).toBeLessThan(longTokenInterval.previous.rankCount - 1);
    expect(longTokenInterval.localInterval.max).toBeLessThanOrEqual(longTokenInterval.interval.max);
    expect(longTokenInterval.localInterval.min).toBeGreaterThanOrEqual(
      longTokenInterval.interval.min,
    );

    const affixInterval = await expectRichMixedRankInterval({
      affixWidths: [36, 28],
      html: longTokenHtml,
      lineCapacity: 1,
      nextWidth: 190,
      previousWidth: 150,
      rootStyle: ["font-size:18px"],
      text: longToken,
    });

    expect(affixInterval.next.rank).toBeGreaterThan(affixInterval.previous.rank);

    const cjkEmoji = "指标🙂测量指标🙂测量指标🙂测量指标🙂测量";
    const cjkInterval = await expectRichMixedRankInterval({
      html: `<span>${cjkEmoji}</span>`,
      lineCapacity: 1,
      nextWidth: 160,
      previousWidth: 100,
      rootStyle: ["font-size:18px"],
      text: cjkEmoji,
    });

    expect(cjkInterval.next.rank).toBeGreaterThan(cjkInterval.previous.rank);

    const clippedText = "observabilityPlatformTelemetryPipeline".repeat(4);
    const clippedInterval = await expectRichMixedRankInterval({
      html: `<span>${clippedText}</span>`,
      lineCapacity: 2,
      maxHeight: "60px",
      nextWidth: 220,
      previousWidth: 160,
      rootStyle: ["font-size:18px", "line-height:28px"],
      text: clippedText,
    });

    expect(clippedInterval.next.textRankSafe).toBe(true);
    expect(clippedInterval.next.rank).toBeGreaterThan(clippedInterval.previous.rank);
  });

  it("bounds mixed-rank movement for combined Rich held-out inputs", async () => {
    const cjkEmoji = "指标🙂测量指标🙂测量指标🙂测量指标🙂测量指标🙂测量";
    const combined = await expectRichMixedRankInterval({
      affixWidths: [32, 24],
      html: `<span>${cjkEmoji}</span>`,
      lineCapacity: 2,
      maxHeight: "60px",
      nextWidth: 220,
      previousWidth: 150,
      rootStyle: ["font-size:18px", "line-height:28px"],
      text: cjkEmoji,
    });

    expect(combined.next.textRankSafe).toBe(true);
    expect(combined.next.rank).toBeGreaterThan(combined.previous.rank);
    expect(combined.localInterval.max).toBeLessThanOrEqual(combined.interval.max);
    expect(combined.localInterval.min).toBeGreaterThanOrEqual(combined.interval.min);
  });

  it("requires scalar credit before broad mixed-rank intervals can drive warm search", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const longTokenHtml = `<span>${longToken}</span>`;
    const plain = await expectRichMixedRankInterval({
      html: longTokenHtml,
      lineCapacity: 1,
      nextWidth: 170,
      previousWidth: 110,
      rootStyle: ["font-size:18px"],
      text: longToken,
    });
    const affixed = await expectRichMixedRankInterval({
      affixWidths: [36, 28],
      html: longTokenHtml,
      lineCapacity: 1,
      nextWidth: 190,
      previousWidth: 150,
      rootStyle: ["font-size:18px"],
      text: longToken,
    });

    for (const sample of [plain, affixed]) {
      const decision = warmSearchDecision({
        allowPatchTieBreak: true,
        count: sample.previous.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: sample.previous.rank,
        interval: sample.interval,
      });
      const localDecision = warmSearchDecision({
        allowPatchTieBreak: true,
        count: sample.previous.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: sample.previous.rank,
        interval: sample.localInterval,
      });

      expect(decision.useWarm).toBe(false);
      expect(decision.requiredCredit).toBeGreaterThan(0);
      expect(localDecision.requiredCredit).toBeLessThanOrEqual(decision.requiredCredit);
      expect(sample.next.rank).toBeGreaterThanOrEqual(sample.interval.min);
      expect(sample.next.rank).toBeLessThanOrEqual(sample.interval.max);
    }
  });

  it("requires actual layout-read credit before using scalar warm credit", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const previousWidth = 110;
    const nextWidth = 170;
    const rootStyle = ["font-size:18px"];
    const sample = await expectRichMixedRankInterval({
      html: `<span>${longToken}</span>`,
      lineCapacity: 1,
      nextWidth,
      previousWidth,
      rootStyle,
      text: longToken,
    });
    const intervalDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: sample.previous.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: sample.previous.rank,
      interval: sample.interval,
    });
    const comparison = await compareRichWarmColdCosts({
      html: `<span>${longToken}</span>`,
      nextWidth,
      previousWidth,
      rootStyle,
    });
    const layoutCredit = wholeLayoutReadCredit(comparison);

    expect(intervalDecision.requiredCredit).toBeGreaterThan(0);
    expect(layoutCredit).toBeLessThan(intervalDecision.requiredCredit);
    expect(
      warmSearchDecision({
        allowPatchTieBreak: true,
        count: sample.previous.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: sample.previous.rank,
        interval: sample.interval,
        warmCredit: layoutCredit,
      }).useWarm,
    ).toBe(false);
  });

  it("separates exact mixed-rank targets from interval uncertainty", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const previousWidth = 110;
    const rootStyle = ["font-size:18px"];
    const sample = await expectRichMixedRankInterval({
      html: `<span>${longToken}</span>`,
      lineCapacity: 1,
      nextWidth: 120,
      previousWidth,
      rootStyle,
      text: longToken,
    });
    const previousText = `${longToken.slice(0, sample.previous.rank)}…`;
    let packingSlack = 0;
    const slackReads = countBoundingRectsDuring(() => {
      packingSlack = Math.max(0, previousWidth - measureTextWidth(previousText, rootStyle));
    });
    const intervalDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: sample.previous.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: sample.previous.rank,
      interval: sample.interval,
    });
    const exactDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: sample.previous.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: sample.previous.rank,
      interval: { max: sample.next.rank, min: sample.next.rank },
    });
    const localDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: sample.previous.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: sample.previous.rank,
      interval: sample.localInterval,
    });
    const slackInterval = estimateTargetRankLocalInterval({
      advance: sample.advance,
      advances: sample.advances,
      lineCapacity: 1,
      nextWidth: 120,
      packingSlack,
      previousRank: sample.previous.rank,
      previousWidth,
      rankCount: sample.previous.rankCount,
    });
    const slackDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: sample.previous.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: sample.previous.rank,
      interval: slackInterval,
    });

    expect(sample.next.rank).toBe(sample.previous.rank + 1);
    expect(exactDecision.requiredCredit).toBe(0);
    expect(exactDecision.useWarm).toBe(true);
    expect(intervalDecision.useWarm).toBe(false);
    expect(intervalDecision.requiredCredit).toBeGreaterThan(0);
    expect(localDecision.requiredCredit).toBeLessThanOrEqual(intervalDecision.requiredCredit);
    expect(slackReads).toBe(1);
    expect(slackInterval.max).toBe(sample.next.rank);
    expect(slackDecision.requiredCredit).toBe(0);
    expect(slackDecision.useWarm).toBe(true);
  });

  it("calibrates dynamic warm width room against browser mixed-rank movement", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const previousWidth = 110;
    const rootStyle = ["font-size:18px", ...stableCalibrationStyle];
    const previous = await collectRichProbeLayout({
      html: `<span>${longToken}</span>`,
      lineLimit: 1,
      rootStyle,
      width: previousWidth,
    });
    if (previous.boundsWidth === undefined) {
      throw new Error("Expected one-line rich text result to publish probe bounds.");
    }

    let advances: readonly number[] = [];
    const advanceReads = countBoundingRectsDuring(() => {
      advances = measureAdvances(longToken, rootStyle);
    });
    const advance = advanceRange(advances);
    const packingSlack = Math.max(0, previousWidth - previous.boundsWidth);
    const room = estimateWarmSearchWidthRoom({
      allowPatchTieBreak: true,
      advances,
      count: previous.rank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: previous.rank.rank,
      lineCapacity: 1,
      packingSlack,
    });
    // Browser layout rounds CSS widths to a device-independent subpixel grid,
    // so keep the observed point clearly inside the algebraic boundary.
    const insideWidth = previousWidth + room.widthDeltaLimit - 0.1;
    const inside = await richMixedRankForLayout({
      html: `<span>${longToken}</span>`,
      rootStyle,
      width: insideWidth,
    });
    const insideInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth: insideWidth,
      packingSlack,
      previousRank: previous.rank.rank,
      previousWidth,
      rankCount: previous.rank.rankCount,
    });
    const boundaryInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth + room.widthDeltaLimit,
      packingSlack,
      previousRank: previous.rank.rank,
      previousWidth,
      rankCount: previous.rank.rankCount,
    });

    expect(room.useWarm).toBe(true);
    expect(room.widthDeltaLimit).toBeGreaterThan(0);
    expect(advanceReads).toBe(graphemeParts(longToken).length + 1);
    expect(advanceReads).toBeGreaterThan(estimateColdSearchMaxProbeCount(previous.rank.rankCount));
    expect(inside.rank).toBeLessThanOrEqual(previous.rank.rank + room.maxRankMove);
    expect(inside.rank).toBeGreaterThanOrEqual(insideInterval.min);
    expect(inside.rank).toBeLessThanOrEqual(insideInterval.max);
    expect(
      warmSearchDecision({
        allowPatchTieBreak: true,
        count: previous.rank.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previous.rank.rank,
        interval: insideInterval,
      }).useWarm,
    ).toBe(true);
    expect(
      warmSearchDecision({
        allowPatchTieBreak: true,
        count: previous.rank.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previous.rank.rank,
        interval: boundaryInterval,
      }).useWarm,
    ).toBe(false);
  });

  it("calibrates dynamic warm shrink room against browser mixed-rank movement", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const previousWidth = 150;
    const rootStyle = ["font-size:18px"];
    const previous = await richMixedRankForLayout({
      html: `<span>${longToken}</span>`,
      rootStyle,
      width: previousWidth,
    });
    const advances = measureAdvances(longToken, rootStyle);
    const advance = advanceRange(advances);
    const previousText = `${longToken.slice(0, previous.rank)}…`;
    const packingSlack = Math.max(0, previousWidth - measureTextWidth(previousText, rootStyle));
    const room = estimateWarmSearchWidthRoom({
      allowPatchTieBreak: true,
      advances,
      count: previous.rankCount,
      direction: -1,
      expansionLimit: richWarmExpansionLimit,
      hint: previous.rank,
      lineCapacity: 1,
      packingSlack,
    });
    const insideWidth = previousWidth - room.widthDeltaLimit + 0.001;
    const inside = await richMixedRankForLayout({
      html: `<span>${longToken}</span>`,
      rootStyle,
      width: insideWidth,
    });
    const insideInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth: insideWidth,
      packingSlack,
      previousRank: previous.rank,
      previousWidth,
      rankCount: previous.rankCount,
    });
    const outsideInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth: previousWidth - room.widthDeltaLimit - 0.001,
      packingSlack,
      previousRank: previous.rank,
      previousWidth,
      rankCount: previous.rankCount,
    });

    expect(room.useWarm).toBe(true);
    expect(room.widthDeltaLimit).toBeGreaterThan(0);
    expect(inside.rank).toBeGreaterThanOrEqual(previous.rank - room.maxRankMove);
    expect(inside.rank).toBeGreaterThanOrEqual(insideInterval.min);
    expect(inside.rank).toBeLessThanOrEqual(insideInterval.max);
    expect(
      warmSearchDecision({
        allowPatchTieBreak: true,
        count: previous.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previous.rank,
        interval: insideInterval,
      }).useWarm,
    ).toBe(true);
    expect(
      warmSearchDecision({
        allowPatchTieBreak: true,
        count: previous.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previous.rank,
        interval: outsideInterval,
      }).useWarm,
    ).toBe(false);
  });

  it("captures ranked rich layout cost without runtime diagnostics", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const fixture = createRichClampFixture({
      html: `<span>${longToken}</span>`,
      rootStyle: ["font-size:18px"],
      width: 110,
    });
    const results: RichClampResult[] = [];

    try {
      const samples = await collectRichProbeCostsDuring(fixture.content, fixture.body, () => {
        results.push(
          clampRich({
            ellipsis: "…",
            from: null,
            hint: null,
            lineLimit: 1,
            maxHeight: undefined,
            prepared: fixture.prepared,
            probe: {
              body: fixture.body,
              content: fixture.content,
              root: fixture.root,
              width: 110,
            },
          }),
        );
      });
      const boundingRectReads = samples.reduce(
        (total, sample) => total + sample.boundingRectReads,
        0,
      );
      const layoutReads = samples.reduce(
        (total, sample) => total + sample.boundingRectReads + sample.clientRectReads,
        0,
      );
      const searchIndex = results[0]?.searchIndex;

      if (!searchIndex || !results[0]?.state) {
        throw new Error("Expected rich search index for ranked probe samples.");
      }

      const layout = measureRichStateLayout(fixture, results[0].state);
      const rank = rankRichState(searchIndex, results[0].state);

      expect(results[0]?.state?.kind).toBe("clamped");
      expect(boundingRectReads).toBeGreaterThan(0);
      expect(samples.length).toBe(layoutReads);
      expect(layout.bounds.width).toBeGreaterThan(0);
      expect(layout.bounds.height).toBeGreaterThan(0);
      expect(rank).not.toBeNull();
      expect(rank?.rank).toBeGreaterThanOrEqual(0);
    } finally {
      fixture.cleanup();
    }
  });

  it("derives one-line rich packing slack from fit probe bounds", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const previousWidth = 110;
    const nextWidth = 120;
    const rootStyle = ["font-size:18px"];
    const probe = await collectRichProbeLayout({
      html: `<span>${longToken}</span>`,
      lineLimit: 1,
      rootStyle,
      width: previousWidth,
    });

    if (!probe.rank.textRankSafe || probe.boundsWidth === undefined) {
      throw new Error("Expected one-line rich text result to publish safe probe bounds.");
    }

    const previousText = `${longToken.slice(0, probe.rank.rank)}…`;
    const measuredSlack = Math.max(0, previousWidth - measureTextWidth(previousText, rootStyle));
    const probeSlack = Math.max(0, previousWidth - probe.boundsWidth);
    const advances = measureAdvances(longToken, rootStyle);
    const advance = advanceRange(advances);
    const localInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const slackInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth,
      packingSlack: probeSlack,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const localDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: probe.rank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: probe.rank.rank,
      interval: localInterval,
    });
    const slackDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: probe.rank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: probe.rank.rank,
      interval: slackInterval,
    });

    expect(probe.fitProbeCount).toBe(probe.rectReads + probe.clientRectReads);
    expect(probeSlack).toBeCloseTo(measuredSlack, 3);
    expect(slackDecision.requiredCredit).toBeLessThanOrEqual(localDecision.requiredCredit);
    expect(slackInterval.max).toBeLessThan(localInterval.max);
    expect(slackDecision.requiredCredit).toBe(0);
    expect(slackDecision.useWarm).toBe(true);
  });

  it("derives affixed one-line rich packing slack from fit probe line boxes", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const affixWidths = [36, 28] as const;
    const previousWidth = 150;
    const nextWidth = 160;
    const rootStyle = ["font-size:18px"];
    const probe = await collectRichProbeLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 1,
      rootStyle,
      width: previousWidth,
    });

    if (!probe.rank.textRankSafe || probe.lineWidth === undefined) {
      throw new Error("Expected affixed rich text result to publish safe line-box width.");
    }

    const previousText = `${longToken.slice(0, probe.rank.rank)}…`;
    const measuredSlack = Math.max(
      0,
      previousWidth - measureTextWidth(previousText, rootStyle) - affixWidths[0] - affixWidths[1],
    );
    const probeSlack = Math.max(0, previousWidth - probe.lineWidth);
    const advances = measureAdvances(longToken, rootStyle);
    const advance = advanceRange(advances);
    const localInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const slackInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 1,
      nextWidth,
      packingSlack: probeSlack,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const localDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: probe.rank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: probe.rank.rank,
      interval: localInterval,
    });
    const slackDecision = warmSearchDecision({
      allowPatchTieBreak: true,
      count: probe.rank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: probe.rank.rank,
      interval: slackInterval,
    });

    expect(probe.fitProbeCount).toBe(probe.clientRectReads);
    expect(probe.rectReads).toBe(0);
    expect(probe.boundsWidth).toBeUndefined();
    expect(probeSlack).toBeCloseTo(measuredSlack, 3);
    expect(localDecision.useWarm).toBe(false);
    expect(localDecision.requiredCredit).toBeGreaterThan(0);
    expect(slackInterval.max).toBeLessThanOrEqual(localInterval.max);
    expect(slackDecision.useWarm).toBe(true);
  });

  it("bounds two-line affixed rich movement with fit probe line slack", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const affixWidths = [36, 28] as const;
    const previousWidth = 150;
    const nextWidth = 170;
    const rootStyle = ["font-size:18px"];
    const probe = await collectRichProbeLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 2,
      rootStyle,
      width: previousWidth,
    });
    const next = await richMixedRankForLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 2,
      rootStyle,
      width: nextWidth,
    });

    if (!probe.rank.textRankSafe || probe.lineSlack === undefined) {
      throw new Error("Expected two-line affixed rich text result to publish safe line slack.");
    }

    const advances = measureAdvances(longToken, rootStyle);
    const advance = advanceRange(advances);
    const localInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 2,
      nextWidth,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const slackInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 2,
      nextWidth,
      packingSlack: probe.lineSlack,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });

    expect(probe.fitProbeCount).toBe(probe.clientRectReads);
    expect(probe.rectReads).toBe(0);
    expect(probe.lineCount).toBe(2);
    expect(probe.boundsWidth).toBeUndefined();
    expect(next.rank).toBeGreaterThanOrEqual(slackInterval.min);
    expect(next.rank).toBeLessThanOrEqual(slackInterval.max);
    expect(slackInterval.max).toBeLessThanOrEqual(localInterval.max);
    expect(slackInterval.min).toBeGreaterThanOrEqual(localInterval.min);
  });

  it("keeps two-line affixed rich shrink outside slack-tightened advance calibration", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const affixWidths = [36, 28] as const;
    const previousWidth = 170;
    const nextWidth = 150;
    const rootStyle = ["font-size:18px"];
    const probe = await collectRichProbeLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 2,
      rootStyle,
      width: previousWidth,
    });
    const next = await richMixedRankForLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 2,
      rootStyle,
      width: nextWidth,
    });

    if (!probe.rank.textRankSafe || probe.lineSlack === undefined) {
      throw new Error("Expected two-line affixed rich text result to publish safe line slack.");
    }

    const advances = measureAdvances(longToken, rootStyle);
    const advance = advanceRange(advances);
    const localInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 2,
      nextWidth,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const unsafeInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 2,
      nextWidth,
      packingSlack: probe.lineSlack,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
      shrinkLineBreaksKnown: true,
    });

    expect(probe.fitProbeCount).toBe(probe.clientRectReads);
    expect(probe.rectReads).toBe(0);
    expect(probe.lineCount).toBe(2);
    expect(probe.boundsWidth).toBeUndefined();
    expect(next.rank).toBeLessThanOrEqual(probe.rank.rank);
    expect(next.rank).toBeGreaterThanOrEqual(localInterval.min);
    expect(next.rank).toBeLessThan(unsafeInterval.min);
    expect(unsafeInterval.max).toBeLessThanOrEqual(localInterval.max);
    expect(unsafeInterval.min).toBeGreaterThanOrEqual(localInterval.min);
  });

  it("observes rich shrink line-count overflow beyond total capacity slack", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const affixWidths = [36, 28] as const;
    const lineLimit = 2;
    const previousWidth = 170;
    const nextWidth = 150;
    const fixture = createRichClampFixture({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit,
      rootStyle: ["font-size:18px"],
      width: previousWidth,
    });

    try {
      const previous = fixture.clamp();
      if (!previous.state || !previous.searchIndex) {
        throw new Error("Expected initial rich clamp to publish searchable state.");
      }

      const rank = rankRichState(previous.searchIndex, previous.state);
      if (!rank?.textRankSafe) {
        throw new Error("Expected two-line affixed rich clamp to publish a safe mixed rank.");
      }

      const before = lineMetricsForRects(
        previousWidth,
        Array.from(fixture.content.getClientRects()),
        lineLimit,
      );
      if (before.slack === undefined) {
        throw new Error("Expected previous rich candidate to publish line slack.");
      }

      fixture.root.style.width = `${nextWidth}px`;
      const next = clampRich({
        ellipsis: "…",
        from: previous.state,
        hint: previous.state,
        lineLimit,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared: fixture.prepared,
        probe: {
          body: fixture.body,
          content: fixture.content,
          root: fixture.root,
          width: nextWidth,
        },
        searchIndex: previous.searchIndex,
        skipFullFit: true,
        verifyFullCandidate: false,
      });

      if (!next.state) {
        throw new Error("Expected next rich clamp to produce a state.");
      }

      const nextRank = rankRichState(previous.searchIndex, next.state);
      if (!nextRank?.textRankSafe) {
        throw new Error("Expected next rich clamp to publish a safe mixed rank.");
      }

      const advances = measureAdvances(longToken, ["font-size:18px"]);
      const unsafeInterval = estimateTargetRankLocalInterval({
        advance: advanceRange(advances),
        advances,
        lineCapacity: lineLimit,
        nextWidth,
        packingSlack: before.slack,
        previousRank: rank.rank,
        previousWidth,
        rankCount: rank.rankCount,
        shrinkLineBreaksKnown: true,
      });
      const predictedRank = unsafeInterval.min;
      const predictedLayout = measureRichRankLayout(fixture, previous.searchIndex, predictedRank);
      const predictedMetrics = lineMetricsForRects(nextWidth, predictedLayout.rects, lineLimit);

      expect(nextRank.rank).toBeLessThan(predictedRank);
      expect(predictedMetrics.lineCount).toBeGreaterThan(lineLimit);
    } finally {
      fixture.cleanup();
    }
  });

  it("bounds three-line affixed rich movement with fit probe line slack", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline".repeat(2);
    const affixWidths = [36, 28] as const;
    const previousWidth = 150;
    const nextWidth = 190;
    const rootStyle = ["font-size:18px"];
    const probe = await collectRichProbeLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 3,
      rootStyle,
      width: previousWidth,
    });
    const next = await richMixedRankForLayout({
      affixWidths,
      html: `<span>${longToken}</span>`,
      lineLimit: 3,
      rootStyle,
      width: nextWidth,
    });

    if (!probe.rank.textRankSafe || probe.lineSlack === undefined) {
      throw new Error("Expected three-line affixed rich text result to publish safe line slack.");
    }

    const advances = measureAdvances(longToken, rootStyle);
    const advance = advanceRange(advances);
    const localInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 3,
      nextWidth,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const slackInterval = estimateTargetRankLocalInterval({
      advance,
      advances,
      lineCapacity: 3,
      nextWidth,
      packingSlack: probe.lineSlack,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });

    expect(probe.fitProbeCount).toBe(probe.clientRectReads);
    expect(probe.rectReads).toBe(0);
    expect(probe.lineCount).toBe(3);
    expect(probe.boundsWidth).toBeUndefined();
    expect(next.rank).toBeGreaterThanOrEqual(slackInterval.min);
    expect(next.rank).toBeLessThanOrEqual(slackInterval.max);
    expect(slackInterval.max).toBeLessThanOrEqual(localInterval.max);
    expect(slackInterval.min).toBeGreaterThanOrEqual(localInterval.min);
  });

  it("counts unused rich lines as grow packing slack", async () => {
    const lineLimit = 2;
    const affixWidths = [20, 12] as const;
    const fixture = createRichClampFixture({
      affixWidths,
      html: "<span></span>",
      lineLimit,
      rootStyle: ["font-size:18px"],
      width: 190,
    });
    const prefixes = [
      "alpha beta gamma",
      "metrics traces logs",
      "release channels",
      "observability data",
    ];
    const suffixes = ["observabilityPlatformTelemetry", "pipelineDiagnostics", "dashboardLatency"];

    try {
      for (const prefix of prefixes) {
        fixture.body.textContent = `${prefix}…`;
        const before = lineMetricsForRects(
          190,
          Array.from(fixture.content.getClientRects()),
          lineLimit,
        );

        if (before.lineCount !== 1 || before.usedWidth === undefined) {
          continue;
        }

        const existingLineSlack = before.lineCount * 190 - before.usedWidth;
        const totalLineSlack = lineLimit * 190 - before.usedWidth;

        for (const suffix of suffixes) {
          fixture.body.textContent = `${prefix} ${suffix}…`;
          const after = lineMetricsForRects(
            190,
            Array.from(fixture.content.getClientRects()),
            lineLimit,
          );

          if (after.lineCount !== 2 || after.usedWidth === undefined) {
            continue;
          }

          const addedWidth = after.usedWidth - before.usedWidth;
          if (addedWidth > existingLineSlack && addedWidth <= totalLineSlack) {
            expect(addedWidth).toBeGreaterThan(existingLineSlack);
            expect(addedWidth).toBeLessThanOrEqual(totalLineSlack);
            expect(totalLineSlack).toBe(existingLineSlack + 190);
            return;
          }
        }
      }
    } finally {
      fixture.cleanup();
    }

    throw new Error("Expected unused line capacity to cover a two-line Rich candidate.");
  });

  it("counts unused rich lines as shrink packing slack", async () => {
    const lineLimit = 2;
    const previousWidth = 190;
    const affixWidths = [20, 12] as const;
    const fixture = createRichClampFixture({
      affixWidths,
      html: "<span></span>",
      lineLimit,
      rootStyle: ["font-size:18px"],
      width: previousWidth,
    });
    const prefixes = [
      "alpha beta gamma",
      "metrics traces logs",
      "release channels",
      "observability data",
    ];

    try {
      for (const prefix of prefixes) {
        fixture.root.style.width = `${previousWidth}px`;
        fixture.body.textContent = `${prefix}…`;
        const before = lineMetricsForRects(
          previousWidth,
          Array.from(fixture.content.getClientRects()),
          lineLimit,
        );

        if (before.lineCount !== 1 || before.usedWidth === undefined) {
          continue;
        }

        const existingLineSlack = before.lineCount * previousWidth - before.usedWidth;
        const totalLineSlack = lineLimit * previousWidth - before.usedWidth;

        for (const nextWidth of [180, 170, 160, 150, 140, 130]) {
          const widthLoss = previousWidth - nextWidth;
          const existingCapacityLoss = widthLoss * before.lineCount;
          const totalCapacityLoss = widthLoss * lineLimit;

          if (existingCapacityLoss <= existingLineSlack || totalCapacityLoss > totalLineSlack) {
            continue;
          }

          fixture.root.style.width = `${nextWidth}px`;
          const after = lineMetricsForRects(
            nextWidth,
            Array.from(fixture.content.getClientRects()),
            lineLimit,
          );

          if (after.lineCount > 0 && after.lineCount <= lineLimit) {
            expect(existingCapacityLoss).toBeGreaterThan(existingLineSlack);
            expect(totalCapacityLoss).toBeLessThanOrEqual(totalLineSlack);
            expect(after.lineCount).toBe(lineLimit);
            return;
          }
        }
      }
    } finally {
      fixture.cleanup();
    }

    throw new Error("Expected unused line capacity to absorb a Rich shrink.");
  });

  it("keeps max-height-only rich bounds outside line-slack calibration", async () => {
    const text = "observabilityPlatformTelemetryPipeline".repeat(4);
    const previousWidth = 160;
    const nextWidth = 220;
    const rootStyle = ["font-size:18px", "line-height:28px"];
    const probe = await collectRichProbeLayout({
      html: `<span>${text}</span>`,
      maxHeight: "60px",
      rootStyle,
      width: previousWidth,
    });
    const next = await richMixedRankForLayout({
      html: `<span>${text}</span>`,
      maxHeight: "60px",
      rootStyle,
      width: nextWidth,
    });

    if (!probe.rank.textRankSafe || probe.boundsWidth === undefined) {
      throw new Error("Expected roomy max-height rich result to publish safe bounds.");
    }

    const advances = measureAdvances(text, rootStyle);
    const interval = estimateTargetRankInterval({
      advance: advanceRange(advances),
      lineCapacity: 2,
      nextWidth,
      previousRank: probe.rank.rank,
      previousWidth,
      rankCount: probe.rank.rankCount,
    });
    const room = estimateWarmSearchWidthRoom({
      advances,
      allowPatchTieBreak: true,
      count: probe.rank.rankCount,
      expansionLimit: richWarmExpansionLimit,
      hint: probe.rank.rank,
      lineCapacity: 2,
    });

    expect(probe.fitProbeCount).toBe(probe.rectReads);
    expect(probe.clientRectReads).toBe(0);
    expect(probe.lineSlack).toBeUndefined();
    expect(probe.boundsWidth).toBeGreaterThan(0);
    expect(next.rank).toBeGreaterThanOrEqual(interval.min);
    expect(next.rank).toBeLessThanOrEqual(interval.max);
    expect(room.widthDeltaLimit).toBe(0);
  });

  it("keeps atomic rich probe bounds outside text-rank slack calibration", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const probe = await collectRichProbeLayout({
      html: `<span style="display:inline-block;width:44px;height:14px;vertical-align:baseline"></span> ${longToken}`,
      lineLimit: 1,
      rootStyle: ["font-size:18px"],
      width: 70,
    });

    expect(probe.fitProbeCount).toBe(probe.clientRectReads);
    expect(probe.rectReads).toBe(0);
    expect(probe.boundsWidth).toBeUndefined();
    expect(probe.lineWidth).toBeGreaterThan(0);
    expect(probe.rank.textRankSafe).toBe(false);
  });

  it("learns adjacent rich candidate advances from warm fit probe bounds", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const rootStyle = ["font-size:18px"];
    const fixture = createRichClampFixture({
      html: `<span>${longToken}</span>`,
      rootStyle,
      width: 110,
    });

    try {
      const previous = fixture.clamp();
      if (!previous.state || !previous.searchIndex) {
        throw new Error("Expected initial rich clamp to publish searchable state.");
      }
      const previousRank = rankRichState(previous.searchIndex, previous.state);
      if (!previousRank) {
        throw new Error("Expected initial rich clamp to publish mixed rank.");
      }

      fixture.root.style.width = "120px";
      clampRich({
        ellipsis: "…",
        from: previous.state,
        hint: previous.state,
        lineLimit: 1,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared: fixture.prepared,
        probe: {
          body: fixture.body,
          content: fixture.content,
          root: fixture.root,
          width: 120,
        },
        searchIndex: previous.searchIndex,
        skipFullFit: true,
        verifyFullCandidate: false,
      });

      const advances = measureAdvances(longToken, rootStyle);
      const requiredWindow = warmSearchAdvanceWindow({
        allowPatchTieBreak: true,
        count: previousRank.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previousRank.rank,
      });
      const widthByRank = new Map<number, number>();
      for (const rank of windowRanks(requiredWindow.indexes)) {
        const layout = measureRichRankLayout(fixture, previous.searchIndex, rank);
        const sampleRank = rankRichState(previous.searchIndex, layout.state);
        if (sampleRank?.textRankSafe) {
          widthByRank.set(sampleRank.rank, layout.bounds.width);
        }
      }

      const learnedAdvances = advancesFromWidths(widthByRank);
      const learnedRank = learnedAdvances.findIndex(
        (advance, rank) =>
          advance > 0 && advances[rank] !== undefined && requiredWindow.indexes.includes(rank),
      );

      expect(requiredWindow.useWarm).toBe(true);
      expect(learnedRank).toBeGreaterThanOrEqual(0);
      expect(learnedAdvances[learnedRank]).toBeCloseTo(advances[learnedRank]!, 3);
    } finally {
      fixture.cleanup();
    }
  });

  it("learns affixed rich candidate advances from line boxes", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const rootStyle = ["font-size:18px"];
    const fixture = createRichClampFixture({
      affixWidths: [36, 28],
      html: `<span>${longToken}</span>`,
      lineLimit: 1,
      rootStyle,
      width: 150,
    });

    try {
      const previous = fixture.clamp();
      if (!previous.state || !previous.searchIndex) {
        throw new Error("Expected initial rich clamp to publish searchable state.");
      }
      const previousRank = rankRichState(previous.searchIndex, previous.state);
      if (!previousRank?.textRankSafe) {
        throw new Error("Expected initial affixed rich clamp to publish safe mixed rank.");
      }

      fixture.root.style.width = "160px";
      clampRich({
        ellipsis: "…",
        from: previous.state,
        hint: previous.state,
        lineLimit: 1,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared: fixture.prepared,
        probe: {
          body: fixture.body,
          content: fixture.content,
          root: fixture.root,
          width: 160,
        },
        searchIndex: previous.searchIndex,
        skipFullFit: true,
        verifyFullCandidate: false,
      });

      const advances = measureAdvances(longToken, rootStyle);
      const requiredWindow = warmSearchAdvanceWindow({
        allowPatchTieBreak: true,
        count: previousRank.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previousRank.rank,
      });
      const widthByRank = new Map<number, number>();
      for (const rank of windowRanks(requiredWindow.indexes)) {
        const layout = measureRichRankLayout(fixture, previous.searchIndex, rank);
        const sampleRank = rankRichState(previous.searchIndex, layout.state);
        const metrics = lineMetricsForRects(160, layout.rects);
        if (sampleRank?.textRankSafe && metrics.maxWidth !== undefined) {
          widthByRank.set(sampleRank.rank, metrics.maxWidth);
        }
      }

      const learnedAdvances = advancesFromWidths(widthByRank);
      const learnedRank = learnedAdvances.findIndex(
        (advance, rank) =>
          advance > 0 && advances[rank] !== undefined && requiredWindow.indexes.includes(rank),
      );

      expect(requiredWindow.useWarm).toBe(true);
      expect(widthByRank.size).toBeGreaterThan(0);
      expect(learnedRank).toBeGreaterThanOrEqual(0);
      expect(learnedAdvances[learnedRank]).toBeCloseTo(advances[learnedRank]!, 3);
    } finally {
      fixture.cleanup();
    }
  });

  it("learns two-line affixed rich candidate advances from line boxes", async () => {
    const longToken = "observabilityPlatformTelemetryPipeline";
    const rootStyle = ["font-size:18px"];
    const fixture = createRichClampFixture({
      affixWidths: [36, 28],
      html: `<span>${longToken}</span>`,
      lineLimit: 2,
      rootStyle,
      width: 150,
    });

    try {
      const previous = fixture.clamp();
      if (!previous.state || !previous.searchIndex) {
        throw new Error("Expected initial rich clamp to publish searchable state.");
      }
      const previousRank = rankRichState(previous.searchIndex, previous.state);
      if (!previousRank?.textRankSafe) {
        throw new Error("Expected initial two-line affixed clamp to publish safe mixed rank.");
      }

      fixture.root.style.width = "170px";
      clampRich({
        ellipsis: "…",
        from: previous.state,
        hint: previous.state,
        lineLimit: 2,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared: fixture.prepared,
        probe: {
          body: fixture.body,
          content: fixture.content,
          root: fixture.root,
          width: 170,
        },
        searchIndex: previous.searchIndex,
        skipFullFit: true,
        verifyFullCandidate: false,
      });

      const advances = measureAdvances(longToken, rootStyle);
      const requiredWindow = warmSearchAdvanceWindow({
        allowPatchTieBreak: true,
        count: previousRank.rankCount,
        expansionLimit: richWarmExpansionLimit,
        hint: previousRank.rank,
      });
      const usedWidthByRank = new Map<number, number>();
      for (const rank of windowRanks(requiredWindow.indexes)) {
        const layout = measureRichRankLayout(fixture, previous.searchIndex, rank);
        const sampleRank = rankRichState(previous.searchIndex, layout.state);
        const metrics = lineMetricsForRects(170, layout.rects);
        if (sampleRank?.textRankSafe && metrics.usedWidth !== undefined) {
          usedWidthByRank.set(sampleRank.rank, metrics.usedWidth);
        }
      }

      const learnedAdvances = advancesFromWidths(usedWidthByRank);
      const learnedRank = learnedAdvances.findIndex(
        (advance, rank) =>
          advance > 0 && advances[rank] !== undefined && requiredWindow.indexes.includes(rank),
      );

      expect(requiredWindow.useWarm).toBe(true);
      expect(usedWidthByRank.size).toBeGreaterThan(0);
      expect(learnedRank).toBeGreaterThanOrEqual(0);
      expect(learnedAdvances[learnedRank]).toBeCloseTo(advances[learnedRank]!, 3);
    } finally {
      fixture.cleanup();
    }
  });

  it("rechecks rich child line metrics before using cached height line counting", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 5,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      for (const span of body.querySelectorAll("span")) {
        span.style.fontSize = "18px";
      }

      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBeGreaterThan(0);
    } finally {
      container.remove();
    }
  });

  it("rechecks stylesheet-driven rich child line metrics before reusing cached height line counting", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const style = document.createElement("style");
    style.textContent = ".metric-host span{font-size:var(--metric-size)}";
    const container = document.createElement("div");
    document.head.append(style);
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "--metric-size:16px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.className = "metric-host";
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 5,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      root.style.setProperty("--metric-size", "18px");

      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBeGreaterThan(0);
    } finally {
      style.remove();
      container.remove();
    }
  });

  it("rechecks rich descendant styles after a width-only reclamp", async () => {
    const html = "<strong>Telemetry</strong> <span>observabilityPlatform1</span> trailing copy";
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 2,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      root.style.width = "320px";
      const calls = countComputedStylesDuring(() => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 2,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 320,
          },
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBeGreaterThan(1);
    } finally {
      container.remove();
    }
  });

  it("rechecks rich descendant styles after inherited line metrics change", async () => {
    const html = [
      "<strong>Telemetry</strong>",
      '<span style="white-space:nowrap">observabilityPlatform1</span>',
      "trailing copy",
    ].join(" ");
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 2,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      root.style.fontSize = "18px";
      root.style.lineHeight = "22px";
      let result: RichClampResult | undefined;
      const calls = countComputedStylesDuring(() => {
        result = clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 2,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBeGreaterThan(1);
      expect(result?.fallback).toBe(false);
    } finally {
      container.remove();
    }
  });

  it("rebuilds rich search metadata when inline wrappers become atomic", async () => {
    const fixture = createRichClampFixture({
      className: "dynamic-rich-host",
      html: "<span>observabilityPlatform1</span> trailing copy",
      styles: [".dynamic-rich-host span{display:inline;width:80px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.querySelector("span")?.textContent).not.toBe("observabilityPlatform1");
      fixture.styles[0]!.textContent = ".dynamic-rich-host span{display:inline-block;width:80px}";
      await settle(1);

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(result.searchIndex?.runs.map((run) => run.kind)).toEqual(["atomic", "text"]);
      expect(fixture.body.querySelector("span")?.textContent).toBe("observabilityPlatform1");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when ancestor attributes change computed display", async () => {
    const fixture = createRichClampFixture({
      className: "attribute-rich-host",
      styles: [
        [
          ".attribute-rich-host .dynamic-token{display:inline;width:180px}",
          ".attribute-rich-host[data-atomic] .dynamic-token{display:inline-block;width:180px}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(first.searchIndex?.runs.map((run) => run.kind)).toEqual(["text"]);
      fixture.root.dataset.atomic = "";

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(result.searchIndex?.runs.map((run) => run.kind)).toEqual(["atomic", "text"]);
      expect(fixture.body.textContent).toBe("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when atomic wrappers become inline", async () => {
    const fixture = createRichClampFixture({
      className: "dynamic-rich-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [".dynamic-rich-host .dynamic-token{display:var(--token-display);width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("continues scanning stylesheets after finding variable rich line metrics", async () => {
    const fixture = createRichClampFixture({
      className: "line-metric-before-display-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [
        ".line-metric-before-display-host strong{font-size:var(--metric-size,16px)}",
        ".line-metric-before-display-host .dynamic-token{display:var(--token-display);width:180px}",
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("finds variable rich display declarations inside grouping rules", async () => {
    const fixture = createRichClampFixture({
      className: "grouped-dynamic-rich-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [
        "@media (min-width:1px){.grouped-dynamic-rich-host .dynamic-token{display:var(--token-display);width:180px}}",
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when a later stylesheet makes atomic wrappers inline", async () => {
    const dynamicStyle = document.createElement("style");
    dynamicStyle.textContent =
      ".late-style-host .dynamic-token{display:var(--token-display);width:180px}";
    const fixture = createRichClampFixture({
      className: "late-style-host",
      rootStyle: ["--token-display:inline"],
      styles: [".late-style-host .dynamic-token{display:inline-block;width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      document.head.append(dynamicStyle);

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      dynamicStyle.remove();
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when an inserted CSSOM rule makes atomic wrappers inline", async () => {
    const fixture = createRichClampFixture({
      className: "insert-rule-host",
      rootStyle: ["--token-display:inline"],
      styles: [".insert-rule-host .dynamic-token{display:inline-block;width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      sheet.insertRule(
        ".insert-rule-host .dynamic-token{display:var(--token-display);width:180px}",
        sheet.cssRules.length,
      );

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when a nested CSSOM rule makes atomic wrappers inline", async () => {
    const fixture = createRichClampFixture({
      className: "nested-rule-host",
      rootStyle: ["--token-display:inline"],
      styles: [
        [
          ".nested-rule-host .dynamic-token{display:inline-block;width:180px}",
          "@media (min-width:1px){}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      const mediaRule = sheet.cssRules[1];
      if (!(mediaRule instanceof CSSMediaRule)) {
        throw new Error("Expected test media rule to be available.");
      }
      mediaRule.insertRule(
        ".nested-rule-host .dynamic-token{display:var(--token-display);width:180px}",
        mediaRule.cssRules.length,
      );

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when a CSSOM rule display changes in place", async () => {
    const fixture = createRichClampFixture({
      className: "mutated-rule-host",
      styles: [".mutated-rule-host .dynamic-token{display:inline-block;width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      const rule = sheet.cssRules[0];
      if (!(rule instanceof CSSStyleRule)) {
        throw new Error("Expected test style rule to be available.");
      }
      rule.style.display = "inline";

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds rich search metadata when a media rule becomes active", async () => {
    const fixture = createRichClampFixture({
      className: "media-change-host",
      rootStyle: ["--token-display:inline"],
      styles: [
        [
          ".media-change-host .dynamic-token{display:inline-block;width:180px}",
          "@media (max-width:1px){.media-change-host .dynamic-token{display:var(--token-display);width:180px}}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      const mediaRule = sheet.cssRules[1];
      if (!(mediaRule instanceof CSSMediaRule)) {
        throw new Error("Expected test media rule to be available.");
      }
      mediaRule.media.mediaText = "(min-width: 1px)";

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("does not depend on readable stylesheet rules for rich layout refresh", async () => {
    const fixture = createRichClampFixture({
      className: "unreadable-style-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [".unreadable-style-host .dynamic-token{display:var(--token-display);width:180px}"],
    });

    try {
      await settle(1);
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }

      const first = withUnreadableStyleSheetRules(sheet, () => fixture.clamp());

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = withUnreadableStyleSheetRules(sheet, () => fixture.reclamp(first));

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("does not read stylesheet rules while refreshing element-rich layout", async () => {
    const fixture = createRichClampFixture({
      className: "signature-scan-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [".signature-scan-host .dynamic-token{display:var(--token-display);width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const calls = countStyleSheetRuleReadsDuring(() => {
        fixture.reclamp(first);
      });

      expect(calls).toBe(0);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("does not scan stylesheets for all-text rich search metadata", async () => {
    const fixture = createRichClampFixture({
      html: "observabilityPlatform1 trailing copy",
    });
    const firstResult: { value?: RichClampResult } = {};

    try {
      await settle(1);
      const firstCalls = countStyleSheetRuleReadsDuring(() => {
        firstResult.value = fixture.clamp();
      });
      const first = firstResult.value;
      if (!first) {
        throw new Error("Expected first rich clamp result.");
      }

      expect(firstCalls).toBe(0);
      expect(first.searchIndex).toBeTruthy();

      const reclampCalls = countStyleSheetRuleReadsDuring(() => {
        fixture.reclamp(first);
      });

      expect(reclampCalls).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  it("uses computed display when variable rules are inside inactive media queries", async () => {
    const fixture = createRichClampFixture({
      className: "inactive-media-host",
      html: '<span class="static-token">observabilityPlatform1</span> trailing copy',
      rootStyle: ["--token-display:inline"],
      styles: [
        [
          ".inactive-media-host .static-token{display:inline-block;width:180px}",
          "@media (max-width:1px){.inactive-media-host .static-token{display:var(--token-display);width:180px}}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");

      const calls = countComputedStylesDuring(() => {
        fixture.reclamp(first);
      });

      expect(calls).toBeGreaterThan(0);
      expect(fixture.body.textContent).toBe("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("verifies full rich text when a hinted run candidate with ellipsis overflows", async () => {
    const html = "abci";
    const ellipsis = "WWWW";
    const style = "font:16px Menlo,monospace;line-height:20px";
    const prepared = prepareRich(html);
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      `width:${Math.ceil(measuredTextWidth(html, style) + 1)}px`,
      style,
      "white-space:normal",
      "overflow-wrap:normal",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.textContent = html;
    content.append(body);
    root.append(content);
    container.append(root);

    const hint: RichState = {
      kind: "clamped",
      point: {
        offset: 3,
        path: [0],
      },
    };

    try {
      await settle(1);
      expect(measuredTextWidth(`abc${ellipsis}`, style)).toBeGreaterThan(
        root.getBoundingClientRect().width,
      );

      const result = clampRich({
        ellipsis,
        from: hint,
        hint,
        lineLimit: 1,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared,
        probe: {
          body,
          content,
          root,
          width: root.getBoundingClientRect().width,
        },
        skipFullFit: true,
      });

      expect(result.state?.kind).toBe("full");
      expect(body.textContent).toBe(html);
      expect(result.fallback).toBe(false);
    } finally {
      container.remove();
    }
  });

  it("measures full rich text before accepting a trailing-whitespace full state", async () => {
    const html = "abc                   ";
    const style = "font:16px Menlo,monospace;line-height:20px";
    const prepared = prepareRich(html);
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      `width:${Math.ceil(measuredTextWidth("abc…", style) + 10)}px`,
      style,
      "white-space:break-spaces",
      "overflow-wrap:normal",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.textContent = html;
    content.append(body);
    root.append(content);
    container.append(root);

    const hint: RichState = {
      kind: "clamped",
      point: {
        offset: 3,
        path: [0],
      },
    };
    const visibleProbeLineCount = () => {
      const lines: Array<{ bottom: number; top: number }> = [];

      for (const rect of content.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        const line = lines.find(
          (current) =>
            Math.abs(current.top - rect.top) <= 0.5 &&
            Math.abs(current.bottom - rect.bottom) <= 0.5,
        );
        if (!line) {
          lines.push({
            bottom: rect.bottom,
            top: rect.top,
          });
        }
      }

      return lines.length;
    };

    try {
      await settle(1);
      expect(visibleProbeLineCount()).toBeGreaterThan(1);

      const result = clampRich({
        ellipsis: "…",
        from: hint,
        hint,
        lineLimit: 1,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared,
        probe: {
          body,
          content,
          root,
          width: root.getBoundingClientRect().width,
        },
        skipFullFit: true,
      });

      expect(result.state?.kind).toBe("clamped");
      expect(body.textContent).not.toBe(html);
      expect(body.textContent).toContain("…");
      expect(visibleProbeLineCount()).toBe(1);
      expect(result.fallback).toBe(false);
    } finally {
      container.remove();
    }
  });

  it("falls back to raw html when descendants leave inline flow", async () => {
    const sourceHtml = "<div>This wrapper stays block layout and should not be clamped.</div>";
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 120,
      props: {
        boundary: "word",
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
  });

  it("does not clip raw html fallback when maxHeight is used", async () => {
    const sourceHtml =
      "<div>This wrapper stays block layout and should remain fully visible when rich clamping gives up.</div>";
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 120,
      props: {
        maxHeight: 20,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(root.style.maxHeight).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("does not treat fitting float rich html as searchable", async () => {
    const sourceHtml =
      '<span style="float:left;height:120px;width:24px">F</span><span>short copy</span>';
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 160,
      props: {
        maxHeight: 40,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(root.style.maxHeight).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("does not treat fitting absolute-positioned rich html as searchable", async () => {
    const sourceHtml =
      '<span style="position:absolute;left:0;top:0;height:120px;width:24px">A</span><span>short copy</span>';
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 160,
      props: {
        maxHeight: 40,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(root.style.maxHeight).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("does not show over-limit rich html lines in the first frame after a width shrink", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      width: 260,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    mounted.width.value = 140;
    await nextTick();

    expect(visibleLineCount(root)).toBeLessThanOrEqual(2);

    await settle(4);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("settles back within the requested rich html line limit after an external container width shrink", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      applyWidthToComponent: false,
      containerStyle: "width:260px",
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    mounted.container.style.width = "140px";
    await settle(4);

    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });
});
