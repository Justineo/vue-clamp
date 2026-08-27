import { clearCache } from "@chenglou/pretext";
import { measureRichInlineStats, prepareRichInline } from "@chenglou/pretext/rich-inline";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { fitsContent } from "../../../packages/vue-clamp/src/layout.ts";
import {
  defaultWarmExpansionLimit,
  warmSearchLocalCoverage,
} from "../../../packages/vue-clamp/src/search.ts";
import {
  clampTextToLayout,
  clampTextToFit,
  prepareText,
  setElementText,
} from "../../../packages/vue-clamp/src/text.ts";
import {
  predictPretextEndClamp,
  preparePretextClamp,
  pretextPredictionHint,
} from "./pretext-integration.ts";

import type {
  PreparedText,
  TextClampHint,
  TextClampResult,
} from "../../../packages/vue-clamp/src/text.ts";
import type { PreparedPretextClamp } from "./pretext-integration.ts";

type Scenario = {
  readonly afterWidth?: number;
  readonly beforeWidth?: number;
  readonly boundary: "grapheme" | "word";
  readonly direction?: "ltr" | "rtl";
  readonly ellipsis: string;
  readonly font: string;
  readonly fontFeatureSettings?: string;
  readonly fontVariantLigatures?: string;
  readonly hyphens?: string;
  readonly kind: "inline" | "line";
  readonly lang?: string;
  readonly letterSpacing?: number;
  readonly lineHeight: number;
  readonly lineLimit: number;
  readonly name: string;
  readonly text: string;
  readonly textTransform?: string;
  readonly widths: readonly number[];
  readonly wordBreak?: "normal" | "keep-all";
  readonly wordSpacing?: number;
};

type Host = {
  readonly container: HTMLElement;
  readonly content: HTMLElement;
  readonly root: HTMLElement;
  readonly target: HTMLElement;
};

type SearchSample = {
  readonly elapsedMs: number;
  readonly probes: number;
  readonly result: TextClampResult;
};

type ScenarioSummary = {
  readonly authorityExact: number;
  readonly authorityMaxRankError: number;
  readonly authorityMeanRankError: number;
  readonly coldMs: number;
  readonly coldProbes: number;
  readonly fullFitPredictions: number;
  readonly fullFitPredictionMatches: number;
  readonly name: string;
  readonly overflowWidths: number;
  readonly predictedMs: number;
  readonly pretextMs: number;
  readonly pretextProbes: number;
  readonly supportedPredictions: number;
  readonly totalWidths: number;
  readonly unsupportedPredictions: number;
  readonly warmMs: number;
  readonly warmProbes: number;
};

type LayoutPathSummary = {
  readonly currentMs: number;
  readonly currentRectReads: number;
  readonly name: string;
  readonly pretextMs: number;
  readonly pretextRectReads: number;
  readonly supportedWidths: number;
};

type ResizePattern = {
  readonly name: string;
  readonly widths: readonly number[];
};

type ResizePathSample = {
  readonly boundingRectReads: number;
  readonly clientRectReads: number;
  readonly elapsedMs: number;
  readonly layoutReads: number;
  readonly mutationRecords: number;
  readonly predictionAttempts: number;
  readonly predictionHints: number;
  readonly rankMoves: readonly number[];
  readonly texts: readonly string[];
  readonly unsupportedPredictions: number;
};

type ResizePredictionMode = "adaptive" | "always" | "none";

type ResizeSummary = {
  readonly adaptiveClientRectReads: number;
  readonly adaptiveLayoutReads: number;
  readonly adaptiveMs: number;
  readonly adaptiveMutationRecords: number;
  readonly adaptivePredictionAttempts: number;
  readonly adaptivePredictionHints: number;
  readonly changes: number;
  readonly currentClientRectReads: number;
  readonly currentLayoutReads: number;
  readonly currentMs: number;
  readonly currentMutationRecords: number;
  readonly currentRankMoveAtMost3: number;
  readonly currentRankMoveAtMost7: number;
  readonly currentRankMoveMax: number;
  readonly currentRankMoveMean: number;
  readonly currentRankMoveP95: number;
  readonly name: string;
  readonly pattern: string;
  readonly predictionPrepareMs: number;
  readonly pretextClientRectReads: number;
  readonly pretextLayoutReads: number;
  readonly pretextMs: number;
  readonly pretextMutationRecords: number;
  readonly repetitions: number;
  readonly unsupportedPredictions: number;
};

const lineWidths = [520, 260, 480, 220, 440, 180, 400, 300, 200, 500, 240, 460, 190];
const inlineWidths = [360, 120, 320, 100, 280, 140, 340, 90, 240, 160, 300];
const englishText =
  "Release dashboards keep customer impact, regional mitigation, and follow-up ownership visible while responsive cards change width.";
const multilingualText =
  "Release AGI 春天到了, بدأت الرحلة 🚀 and regional responders keep customer context visible.";
const wordWarmCoverage = warmSearchLocalCoverage(defaultWarmExpansionLimit + 1);

function widthSweep(start: number, end: number, step: number): number[] {
  const widths: number[] = [];

  for (let width = start; step > 0 ? width <= end : width >= end; width += step) {
    widths.push(width);
  }

  return widths;
}

function repeatedWidths(widths: readonly number[], repetitions: number): number[] {
  const result: number[] = [];

  for (let index = 0; index < repetitions; index += 1) {
    result.push(...widths);
  }

  return result;
}

function jitterWidths(
  count: number,
  start: number,
  min: number,
  max: number,
  maxDelta: number,
  seed: number,
): number[] {
  const widths = [start];
  let width = start;
  let state = seed;

  while (widths.length < count) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const unit = state / 0x100000000;
    const delta = Math.round((unit * 2 - 1) * maxDelta);
    width = Math.max(min, Math.min(max, width + (delta === 0 ? 1 : delta)));
    widths.push(width);
  }

  return widths;
}

const resizePatterns: readonly ResizePattern[] = [
  {
    name: "continuous",
    widths: [...widthSweep(460, 180, -1), ...widthSweep(181, 460, 1)],
  },
  {
    name: "jitter",
    widths: jitterWidths(561, 330, 180, 460, 19, 0x42),
  },
  {
    name: "jumps",
    widths: repeatedWidths([460, 180, 440, 200, 420, 160, 450, 230, 390, 190, 460], 51),
  },
];

const scenarios: readonly Scenario[] = [
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px Georgia",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-english-custom-ellipsis",
    text: englishText,
    widths: lineWidths,
  },
  {
    boundary: "word",
    ellipsis: "…",
    font: "16px Georgia",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-english-word",
    text: englishText,
    widths: lineWidths,
  },
  {
    boundary: "word",
    ellipsis: "…",
    font: "16px Arial",
    kind: "line",
    lang: "zh",
    lineHeight: 22,
    lineLimit: 3,
    name: "line-cjk-word",
    text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任，同时避免关键短语被截断。",
    widths: lineWidths,
  },
  {
    boundary: "word",
    ellipsis: "…",
    font: "16px Arial",
    kind: "line",
    lang: "th",
    lineHeight: 22,
    lineLimit: 3,
    name: "line-thai-word",
    text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    direction: "rtl",
    ellipsis: "… متابعة",
    font: "16px Arial",
    kind: "line",
    lang: "ar",
    lineHeight: 22,
    lineLimit: 3,
    name: "line-arabic-bidi-custom-ellipsis",
    text: "فرق الاستجابة تراجع incident 4721 و API latency وتبقي ownership واضحا أثناء تغيّر العرض.",
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "…",
    font: "16px Arial",
    kind: "line",
    lineHeight: 22,
    lineLimit: 3,
    name: "line-emoji-zwj",
    text: "Incident roles 👩‍💻 🧑‍🚒 👨‍👩‍👧‍👦 stay grouped with status signals ✅ ❤️‍🔥 while dashboards resize.",
    widths: lineWidths,
  },
  {
    boundary: "word",
    ellipsis: "…",
    font: "16px Georgia",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-long-token-fallback",
    text: "observabilityPlatformBoundaryWithoutBreaks".repeat(7),
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px Georgia",
    kind: "line",
    letterSpacing: 1.25,
    lineHeight: 21,
    lineLimit: 3,
    name: "line-letter-spacing",
    text: englishText,
    widths: lineWidths,
  },
  {
    afterWidth: 48,
    beforeWidth: 42,
    boundary: "grapheme",
    ellipsis: "…",
    font: "16px Georgia",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-fixed-affix-reserves",
    text: englishText,
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px system-ui",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-system-ui",
    text: multilingualText,
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px Georgia",
    kind: "line",
    lang: "en",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-unmodeled-hyphens",
    hyphens: "auto",
    text: "Internationalization interoperability representation configuration " + englishText,
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px Georgia",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-unmodeled-uppercase",
    text: englishText.toLowerCase(),
    textTransform: "uppercase",
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px Georgia",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-unmodeled-word-spacing",
    text: englishText,
    widths: lineWidths,
    wordSpacing: 5,
  },
  {
    boundary: "grapheme",
    ellipsis: "… continue",
    font: "16px Georgia",
    fontFeatureSettings: '"liga" 0',
    fontVariantLigatures: "none",
    kind: "line",
    lineHeight: 21,
    lineLimit: 3,
    name: "line-unmodeled-ligatures",
    text: "office affine efficient official difficult fixture ".repeat(4),
    widths: lineWidths,
  },
  {
    boundary: "grapheme",
    ellipsis: "...",
    font: "16px Georgia",
    kind: "inline",
    lineHeight: 21,
    lineLimit: 1,
    name: "inline-custom-ellipsis",
    text: "/workspace/vue-clamp/packages/components/long-generated-file-name.browser.test.ts",
    widths: inlineWidths,
  },
  {
    boundary: "word",
    ellipsis: "…",
    font: "16px Georgia",
    kind: "inline",
    lineHeight: 21,
    lineLimit: 1,
    name: "inline-word-boundary",
    text: "Customer incident summaries preserve complete words while the available width changes.",
    widths: inlineWidths,
  },
];

function applyTextStyle(element: HTMLElement, scenario: Scenario): void {
  element.style.font = scenario.font;
  element.style.lineHeight = `${scenario.lineHeight}px`;
  element.style.letterSpacing = `${scenario.letterSpacing ?? 0}px`;
  element.style.overflowWrap = "break-word";
  element.style.wordBreak = scenario.wordBreak ?? "normal";
  element.style.whiteSpace = scenario.kind === "inline" ? "nowrap" : "normal";

  if (scenario.direction) element.dir = scenario.direction;
  if (scenario.fontFeatureSettings) {
    element.style.fontFeatureSettings = scenario.fontFeatureSettings;
  }
  if (scenario.fontVariantLigatures) {
    element.style.fontVariantLigatures = scenario.fontVariantLigatures;
  }
  if (scenario.hyphens) element.style.hyphens = scenario.hyphens;
  if (scenario.lang) element.lang = scenario.lang;
  if (scenario.textTransform) element.style.textTransform = scenario.textTransform;
  if (scenario.wordSpacing !== undefined) {
    element.style.wordSpacing = `${scenario.wordSpacing}px`;
  }
}

function affix(width: number, text: string): HTMLElement {
  const element = document.createElement("span");
  element.textContent = text;
  element.style.display = "inline-block";
  element.style.height = "1em";
  element.style.overflow = "hidden";
  element.style.width = `${width}px`;
  return element;
}

function mountHost(scenario: Scenario, width: number): Host {
  const container = document.createElement("div");
  const root = document.createElement(scenario.kind === "inline" ? "span" : "div");
  const content = document.createElement("span");
  const body = document.createElement("span");
  const target = document.createElement("span");

  applyTextStyle(root, scenario);
  root.style.display = scenario.kind === "inline" ? "inline-block" : "block";
  root.style.overflow = "hidden";
  root.style.width = `${width}px`;
  body.style.position = "relative";

  if (scenario.beforeWidth) content.append(affix(scenario.beforeWidth, "NEW"));
  body.append(target);
  content.append(body);
  if (scenario.afterWidth) content.append(affix(scenario.afterWidth, "MORE"));
  root.append(content);
  container.append(root);
  document.body.append(container);

  return { container, content, root, target };
}

function candidateFits(host: Host, scenario: Scenario): boolean {
  if (scenario.kind === "inline") {
    return host.root.scrollWidth <= host.root.clientWidth + 0.5;
  }

  return fitsContent(host.root, host.content, scenario.lineLimit, undefined, true);
}

function runSearch(
  host: Host,
  scenario: Scenario,
  prepared: PreparedText,
  hint: TextClampHint | null,
): SearchSample {
  setElementText(host.target, scenario.text);
  let probes = 0;
  const start = performance.now();
  const result = clampTextToFit({
    ellipsis: scenario.ellipsis,
    fits(candidate) {
      probes += 1;
      setElementText(host.target, candidate);
      return candidateFits(host, scenario);
    },
    hint,
    prepared,
    ratio: 1,
  });

  return { elapsedMs: performance.now() - start, probes, result };
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function runScenario(scenario: Scenario): ScenarioSummary {
  const prepared = prepareText(scenario.text, scenario.boundary);
  const pretextConfig = {
    ellipsis: scenario.ellipsis,
    firstLineReserve: scenario.beforeWidth,
    font: scenario.font,
    lastLineReserve: scenario.afterWidth,
    letterSpacing: scenario.letterSpacing,
    lineLimit: scenario.lineLimit,
    maxWidth: scenario.widths[0] ?? 0,
    wordBreak: scenario.wordBreak,
  } as const;
  const pretext = preparePretextClamp(scenario.text, pretextConfig);
  const rankErrors: number[] = [];
  let authorityExact = 0;
  let coldMs = 0;
  let coldProbes = 0;
  let fullFitPredictions = 0;
  let fullFitPredictionMatches = 0;
  let overflowWidths = 0;
  let predictedMs = 0;
  let pretextMs = 0;
  let pretextProbes = 0;
  let supportedPredictions = 0;
  let unsupportedPredictions = 0;
  let warmMs = 0;
  let warmProbes = 0;
  let previous: TextClampResult | null = null;

  for (const width of scenario.widths) {
    const host = mountHost(scenario, width);

    try {
      setElementText(host.target, scenario.text);
      const fullFits = candidateFits(host, scenario);
      const predictionStart = performance.now();
      const prediction = predictPretextEndClamp(prepared, pretext, {
        ...pretextConfig,
        maxWidth: width,
      });
      predictedMs += performance.now() - predictionStart;

      if (!prediction.supported) {
        unsupportedPredictions += 1;
        continue;
      }

      supportedPredictions += 1;
      const predictedFull = prediction.kept >= prepared.boundaryOffsets.length - 1;
      fullFitPredictions += predictedFull ? 1 : 0;
      fullFitPredictionMatches += predictedFull === fullFits ? 1 : 0;

      if (fullFits) {
        const fullRank = prepared.boundaryOffsets.length - 1;
        const error = Math.abs(prediction.kept - fullRank);
        rankErrors.push(error);
        authorityExact += error === 0 ? 1 : 0;
        previous = {
          boundaryOffsets: prepared.boundaryOffsets,
          ellipsis: scenario.ellipsis,
          kept: fullRank,
          ratio: 1,
          spacing: "trim",
          text: scenario.text,
        };
        continue;
      }

      overflowWidths += 1;
      const cold = runSearch(host, scenario, prepared, null);
      const warm = runSearch(host, scenario, prepared, previous);
      const hinted = runSearch(
        host,
        scenario,
        prepared,
        pretextPredictionHint(prepared, prediction, scenario.ellipsis),
      );

      expect(warm.result.text).toBe(cold.result.text);
      expect(hinted.result.text).toBe(cold.result.text);

      const rankError = Math.abs(prediction.kept - cold.result.kept);
      rankErrors.push(rankError);
      authorityExact += rankError === 0 ? 1 : 0;
      coldMs += cold.elapsedMs;
      coldProbes += cold.probes;
      warmMs += warm.elapsedMs;
      warmProbes += warm.probes;
      pretextMs += hinted.elapsedMs;
      pretextProbes += hinted.probes;
      previous = cold.result;
    } finally {
      host.container.remove();
    }
  }

  return {
    authorityExact,
    authorityMaxRankError: Math.max(0, ...rankErrors),
    authorityMeanRankError: round(mean(rankErrors)),
    coldMs: round(coldMs),
    coldProbes,
    fullFitPredictions,
    fullFitPredictionMatches,
    name: scenario.name,
    overflowWidths,
    predictedMs: round(predictedMs),
    pretextMs: round(pretextMs),
    pretextProbes,
    supportedPredictions,
    totalWidths: scenario.widths.length,
    unsupportedPredictions,
    warmMs: round(warmMs),
    warmProbes,
  };
}

function runLayoutPath(
  scenario: Scenario,
  width: number,
  predictedHint: TextClampHint | null,
): { elapsedMs: number; rectReads: number; result: TextClampResult } {
  const host = mountHost(scenario, width);
  const prepared = prepareText(scenario.text, scenario.boundary);
  const originalGetClientRects = host.content.getClientRects.bind(host.content);
  let rectReads = 0;

  Object.defineProperty(host.content, "getClientRects", {
    configurable: true,
    value: () => {
      rectReads += 1;
      return originalGetClientRects();
    },
  });
  setElementText(host.target, scenario.text);

  try {
    const start = performance.now();
    const result = clampTextToLayout({
      content: host.content,
      ellipsis: scenario.ellipsis,
      hasAffixes: !!scenario.beforeWidth || !!scenario.afterWidth,
      hint: null,
      lineCapacity: scenario.lineLimit,
      layoutKey: `${scenario.beforeWidth ?? 0}|${scenario.afterWidth ?? 0}`,
      lineLimit: scenario.lineLimit,
      maxHeight: undefined,
      prepared,
      predictedHint,
      ratio: 1,
      root: host.root,
      rootWidth: width,
      target: host.target,
    });
    const elapsedMs = performance.now() - start;

    if (result === null) {
      throw new Error(`Layout research returned null for ${scenario.name} at ${width}px.`);
    }

    return { elapsedMs, rectReads, result };
  } finally {
    host.container.remove();
  }
}

function runLayoutScenario(scenario: Scenario): LayoutPathSummary {
  const prepared = prepareText(scenario.text, scenario.boundary);
  const baseConfig = {
    ellipsis: scenario.ellipsis,
    firstLineReserve: scenario.beforeWidth,
    font: scenario.font,
    lastLineReserve: scenario.afterWidth,
    letterSpacing: scenario.letterSpacing,
    lineLimit: scenario.lineLimit,
    maxWidth: scenario.widths[0] ?? 0,
    wordBreak: scenario.wordBreak,
  } as const;
  const pretext = preparePretextClamp(scenario.text, baseConfig);
  let currentMs = 0;
  let currentRectReads = 0;
  let pretextMs = 0;
  let pretextRectReads = 0;
  let supportedWidths = 0;

  for (const width of scenario.widths) {
    const prediction = predictPretextEndClamp(prepared, pretext, {
      ...baseConfig,
      maxWidth: width,
    });
    if (!prediction.supported) {
      continue;
    }

    const current = runLayoutPath(scenario, width, null);
    const predicted = runLayoutPath(
      scenario,
      width,
      pretextPredictionHint(prepared, prediction, scenario.ellipsis),
    );
    expect(predicted.result.text).toBe(current.result.text);

    currentMs += current.elapsedMs;
    currentRectReads += current.rectReads;
    pretextMs += predicted.elapsedMs;
    pretextRectReads += predicted.rectReads;
    supportedWidths += 1;
  }

  return {
    currentMs: round(currentMs),
    currentRectReads,
    name: scenario.name,
    pretextMs: round(pretextMs),
    pretextRectReads,
    supportedWidths,
  };
}

function runResizePath(
  scenario: Scenario,
  widths: readonly number[],
  prepared: PreparedText,
  pretext: PreparedPretextClamp,
  predictionMode: ResizePredictionMode,
): ResizePathSample {
  const initialWidth = widths[0];
  if (initialWidth === undefined) {
    throw new Error(`Resize scenario ${scenario.name} requires an initial width.`);
  }

  const host = mountHost(scenario, initialWidth);
  const originalGetBoundingClientRect = host.content.getBoundingClientRect.bind(host.content);
  const originalGetClientRects = host.content.getClientRects.bind(host.content);
  let boundingRectReads = 0;
  let clientRectReads = 0;
  Object.defineProperty(host.content, "getBoundingClientRect", {
    configurable: true,
    value: () => {
      boundingRectReads += 1;
      return originalGetBoundingClientRect();
    },
  });
  Object.defineProperty(host.content, "getClientRects", {
    configurable: true,
    value: () => {
      clientRectReads += 1;
      return originalGetClientRects();
    },
  });

  const observer = new MutationObserver(() => {});
  observer.observe(host.target, { characterData: true, childList: true, subtree: true });
  setElementText(host.target, scenario.text);
  const commonInput = {
    content: host.content,
    ellipsis: scenario.ellipsis,
    hasAffixes: !!scenario.beforeWidth || !!scenario.afterWidth,
    lineCapacity: scenario.lineLimit,
    layoutKey: `${scenario.beforeWidth ?? 0}|${scenario.afterWidth ?? 0}`,
    lineLimit: scenario.lineLimit,
    maxHeight: undefined,
    prepared,
    ratio: 1,
    root: host.root,
    reuseFullFitOnGrow: !scenario.beforeWidth && !scenario.afterWidth,
    simpleLineFit: {
      lineHeight: scenario.lineHeight,
      verifyOverflow: !!scenario.beforeWidth || !!scenario.afterWidth,
    },
    target: host.target,
  } as const;

  try {
    let hint = clampTextToLayout({
      ...commonInput,
      hint: null,
      rootWidth: initialWidth,
    });
    if (hint === null) {
      throw new Error(`Initial resize layout returned null for ${scenario.name}.`);
    }

    boundingRectReads = 0;
    clientRectReads = 0;
    observer.takeRecords();
    const rankMoves: number[] = [];
    const texts: string[] = [];
    let predictionAttempts = 0;
    let predictionHints = 0;
    let unsupportedPredictions = 0;
    const start = performance.now();

    for (const width of widths.slice(1)) {
      host.root.style.width = `${width}px`;
      const previousKept = hint.kept;
      let predictedHint: TextClampHint | null = null;
      const adaptiveScenarioEligible =
        scenario.boundary === "word" &&
        prepared.boundaryOffsets.length > 2 &&
        !scenario.beforeWidth &&
        !scenario.afterWidth &&
        !scenario.font.includes("system-ui") &&
        !scenario.fontFeatureSettings &&
        !scenario.fontVariantLigatures &&
        !scenario.hyphens &&
        !scenario.textTransform &&
        scenario.wordSpacing === undefined;
      const widthDelta = Math.abs(width - (hint.rootWidth ?? width));
      const observedRankMove =
        hint.rootWidth && hint.rootWidth > 0 ? (widthDelta * hint.kept) / hint.rootWidth : 0;
      const shouldPredict =
        predictionMode === "always" ||
        (predictionMode === "adaptive" &&
          adaptiveScenarioEligible &&
          observedRankMove > wordWarmCoverage);

      if (shouldPredict) {
        predictionAttempts += 1;
        const prediction = predictPretextEndClamp(prepared, pretext, {
          ellipsis: scenario.ellipsis,
          firstLineReserve: scenario.beforeWidth,
          font: scenario.font,
          lastLineReserve: scenario.afterWidth,
          letterSpacing: scenario.letterSpacing,
          lineLimit: scenario.lineLimit,
          maxWidth: width,
          wordBreak: scenario.wordBreak,
        });
        if (prediction.supported) {
          const modeledWordJump =
            predictionMode === "always" ||
            (adaptiveScenarioEligible &&
              prediction.kept > 0 &&
              Math.abs(prediction.kept - hint.kept) > wordWarmCoverage);

          if (modeledWordJump) {
            predictedHint = pretextPredictionHint(prepared, prediction, scenario.ellipsis);
            predictionHints += 1;
          }
        } else {
          unsupportedPredictions += 1;
        }
      }

      hint = clampTextToLayout({
        ...commonInput,
        hint,
        predictedHint,
        rootWidth: width,
      });
      if (hint === null) {
        throw new Error(`Resize layout returned null for ${scenario.name} at ${width}px.`);
      }

      rankMoves.push(Math.abs(hint.kept - previousKept));
      texts.push(hint.text);
    }

    return {
      boundingRectReads,
      clientRectReads,
      elapsedMs: performance.now() - start,
      layoutReads: boundingRectReads + clientRectReads,
      mutationRecords: observer.takeRecords().length,
      predictionAttempts,
      predictionHints,
      rankMoves,
      texts,
      unsupportedPredictions,
    };
  } finally {
    observer.disconnect();
    host.container.remove();
  }
}

function summarizeResizeScenario(
  scenario: Scenario,
  pattern: ResizePattern,
  repetitions: number,
): ResizeSummary {
  const prepared = prepareText(scenario.text, scenario.boundary);
  clearCache();
  const prepareStart = performance.now();
  const pretext = preparePretextClamp(scenario.text, {
    ellipsis: scenario.ellipsis,
    firstLineReserve: scenario.beforeWidth,
    font: scenario.font,
    lastLineReserve: scenario.afterWidth,
    letterSpacing: scenario.letterSpacing,
    lineLimit: scenario.lineLimit,
    maxWidth: pattern.widths[0] ?? 0,
    wordBreak: scenario.wordBreak,
  });
  const predictionPrepareMs = performance.now() - prepareStart;
  const adaptiveRuns: ResizePathSample[] = [];
  const currentRuns: ResizePathSample[] = [];
  const pretextRuns: ResizePathSample[] = [];

  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const modes: ResizePredictionMode[] = ["none", "always", "adaptive"];
    const offset = repetition % modes.length;
    const orderedModes = [...modes.slice(offset), ...modes.slice(0, offset)];
    const runs = new Map<ResizePredictionMode, ResizePathSample>();

    for (const mode of orderedModes) {
      runs.set(mode, runResizePath(scenario, pattern.widths, prepared, pretext, mode));
    }

    const current = runs.get("none");
    const predicted = runs.get("always");
    const adaptive = runs.get("adaptive");
    if (!current || !predicted || !adaptive) {
      throw new Error(`Missing resize comparison path for ${scenario.name}.`);
    }

    expect(predicted.texts).toEqual(current.texts);
    expect(adaptive.texts).toEqual(current.texts);
    adaptiveRuns.push(adaptive);
    currentRuns.push(current);
    pretextRuns.push(predicted);
  }

  const currentRankMoves = currentRuns[0]?.rankMoves ?? [];

  return {
    adaptiveClientRectReads: median(adaptiveRuns.map((run) => run.clientRectReads)),
    adaptiveLayoutReads: median(adaptiveRuns.map((run) => run.layoutReads)),
    adaptiveMs: round(median(adaptiveRuns.map((run) => run.elapsedMs))),
    adaptiveMutationRecords: median(adaptiveRuns.map((run) => run.mutationRecords)),
    adaptivePredictionAttempts: median(adaptiveRuns.map((run) => run.predictionAttempts)),
    adaptivePredictionHints: median(adaptiveRuns.map((run) => run.predictionHints)),
    changes: Math.max(0, pattern.widths.length - 1),
    currentClientRectReads: median(currentRuns.map((run) => run.clientRectReads)),
    currentLayoutReads: median(currentRuns.map((run) => run.layoutReads)),
    currentMs: round(median(currentRuns.map((run) => run.elapsedMs))),
    currentMutationRecords: median(currentRuns.map((run) => run.mutationRecords)),
    currentRankMoveAtMost3: currentRankMoves.filter((move) => move <= 3).length,
    currentRankMoveAtMost7: currentRankMoves.filter((move) => move <= 7).length,
    currentRankMoveMax: Math.max(0, ...currentRankMoves),
    currentRankMoveMean: round(mean(currentRankMoves)),
    currentRankMoveP95: percentile(currentRankMoves, 0.95),
    name: scenario.name,
    pattern: pattern.name,
    predictionPrepareMs: round(predictionPrepareMs),
    pretextClientRectReads: median(pretextRuns.map((run) => run.clientRectReads)),
    pretextLayoutReads: median(pretextRuns.map((run) => run.layoutReads)),
    pretextMs: round(median(pretextRuns.map((run) => run.elapsedMs))),
    pretextMutationRecords: median(pretextRuns.map((run) => run.mutationRecords)),
    repetitions,
    unsupportedPredictions: Math.max(0, ...pretextRuns.map((run) => run.unsupportedPredictions)),
  };
}

function domLineCount(element: HTMLElement): number {
  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
  return Math.max(1, Math.round(element.getBoundingClientRect().height / lineHeight));
}

function richInlineSummary() {
  const items = [
    { font: "16px Georgia", text: "Ship the " },
    { font: "700 16px Georgia", text: "regional mitigation" },
    { font: "16px Georgia", text: " with " },
    { break: "never" as const, extraWidth: 18, font: "700 13px Arial", text: "Platform" },
    { font: "16px Georgia", text: " ownership and customer context intact." },
  ];
  const prepared = prepareRichInline(items);
  const widths = [180, 220, 260, 300, 340, 380, 420];
  let exact = 0;
  const rows = [];

  for (const width of widths) {
    const root = document.createElement("div");
    root.style.cssText = `font:16px Georgia;line-height:22px;overflow-wrap:break-word;width:${width}px`;
    root.append("Ship the ");
    const strong = document.createElement("strong");
    strong.textContent = "regional mitigation";
    root.append(strong, " with ");
    const chip = document.createElement("span");
    chip.textContent = "Platform";
    chip.style.cssText =
      "display:inline-block;font:700 13px Arial;padding:0 8px;white-space:nowrap";
    root.append(chip, " ownership and customer context intact.");
    document.body.append(root);

    const dom = domLineCount(root);
    const predicted = measureRichInlineStats(prepared, width).lineCount;
    exact += dom === predicted ? 1 : 0;
    rows.push({ dom, predicted, width });
    root.remove();
  }

  return { exact, rows, total: widths.length };
}

describe("Pretext integration research", () => {
  it("compares Pretext candidate hints with browser-authoritative text search", () => {
    const results = scenarios.map(runScenario);

    console.error(`PRETEXT_TEXT_RESULT ${JSON.stringify(results)}`);
    expect(results.some((result) => result.supportedPredictions > 0)).toBe(true);
  });

  it("compares the narrow rich-inline model with browser rows", () => {
    const result = richInlineSummary();

    expect(result.total).toBeGreaterThan(0);
    console.error(`PRETEXT_RICH_RESULT ${JSON.stringify(result)}`);
  });

  it("compares Pretext with the current paid cold hint in the complete Line layout path", () => {
    const results = scenarios.filter((scenario) => scenario.kind === "line").map(runLayoutScenario);

    expect(results.some((result) => result.supportedWidths > 0)).toBe(true);
    console.error(`PRETEXT_LAYOUT_RESULT ${JSON.stringify(results)}`);
  });

  it("compares Pretext with retained warm hints during frequent container resizes", () => {
    const selectedNames = new Set([
      "line-english-custom-ellipsis",
      "line-english-word",
      "line-cjk-word",
      "line-long-token-fallback",
      "line-fixed-affix-reserves",
      "line-unmodeled-uppercase",
    ]);
    const lineScenarios = scenarios.filter((scenario) => selectedNames.has(scenario.name));
    const results = lineScenarios.flatMap((scenario) =>
      resizePatterns.map((pattern) => summarizeResizeScenario(scenario, pattern, 5)),
    );

    expect(results).toHaveLength(lineScenarios.length * resizePatterns.length);
    console.error(`PRETEXT_RESIZE_RESULT ${JSON.stringify(results)}`);
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});
