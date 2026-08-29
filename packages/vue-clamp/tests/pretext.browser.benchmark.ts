import { clearCache, prepareWithSegments } from "@chenglou/pretext";
import { createApp, defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { clampTextToLayout, prepareText, setElementText } from "../src/text.ts";
import { LineClamp } from "../src/pretext.ts";
import { clampPreparedLine, prepareLineClamp } from "../src/pretext/clamp.ts";

import type { App } from "vue";
import type { ClampBoundary } from "../src/types.ts";
import type { PreparedText, TextClampResult } from "../src/text.ts";
import type { PreparedLineClamp } from "../src/pretext/clamp.ts";

type Scenario = {
  readonly boundary?: ClampBoundary;
  readonly ellipsis?: string;
  readonly exact?: boolean;
  readonly font: string;
  readonly name: string;
  readonly text: string;
};

type Pattern = {
  readonly name: string;
  readonly widths: readonly number[];
};

type Host = {
  readonly container: HTMLElement;
  readonly content: HTMLElement;
  readonly root: HTMLElement;
  readonly target: HTMLElement;
};

type Run = {
  readonly layoutReads: number;
  readonly ms: number;
  readonly texts: readonly string[];
};

type CoreRun = {
  readonly checksum: number;
  readonly ms: number;
};

type ScaleMetrics = {
  readonly callbackCount: number;
  readonly entryCount: number;
  readonly instanceCount: number;
  readonly mutationCount: number;
  readonly resizeMs: number;
  readonly vnodeUpdates: number;
};

const lineLimit = 3;
const lineHeight = 22;
const repetitions = 5;
const coreCycles = 200;
const preparationCount = 1_000;
const scaleInstances = 200;
const scaleRepetitions = 3;
const originalResizeObserver = globalThis.ResizeObserver;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function widthSweep(start: number, end: number, step: number): number[] {
  const widths: number[] = [];
  for (let width = start; step > 0 ? width <= end : width >= end; width += step) {
    widths.push(width);
  }
  return widths;
}

function repeatedWidths(widths: readonly number[], count: number): number[] {
  return Array.from({ length: count }, () => widths).flat();
}

function jitterWidths(count: number): number[] {
  const widths = [330];
  let state = 0x42;

  while (widths.length < count) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const previous = widths.at(-1) ?? 330;
    const delta = Math.round(((state / 0x100000000) * 2 - 1) * 19) || 1;
    widths.push(Math.max(180, Math.min(460, previous + delta)));
  }

  return widths;
}

const patterns: readonly Pattern[] = [
  {
    name: "continuous",
    widths: [...widthSweep(460, 180, -1), ...widthSweep(181, 460, 1)],
  },
  { name: "jitter", widths: jitterWidths(561) },
  {
    name: "jumps",
    widths: repeatedWidths([460, 180, 440, 200, 420, 160, 450, 230, 390, 190, 460], 51),
  },
];

const defaultScenarios: readonly Scenario[] = [
  {
    exact: true,
    font: "16px Georgia",
    name: "english",
    text: "Release dashboards keep customer impact, regional mitigation, and follow-up ownership visible while responsive cards change width.",
  },
  {
    exact: true,
    font: "16px Arial",
    name: "cjk",
    text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任，同时避免关键短语被截断。",
  },
  {
    exact: true,
    font: "16px Arial",
    name: "thai",
    text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
  },
  {
    font: "16px Arial",
    name: "emoji",
    text: "Status 👩🏽‍💻 ready, family 👨‍👩‍👧‍👦 notified, flags 🇺🇳🇯🇵 checked, and café e\u0301lan reviewed.",
  },
  {
    font: "16px Arial",
    name: "mixed-script",
    text: "Incident تحديث 状態 update — 고객 영향, mitigación, and متابعة ownership remain visible.",
  },
  {
    font: "16px Arial",
    name: "long-token",
    text: "observabilityPlatformBoundary👩‍🚀e\u0301".repeat(7),
  },
];

const customEllipsisScenarios: readonly Scenario[] = [
  {
    ellipsis: "...",
    font: "16px Georgia",
    name: "custom-english-word",
    text: "Release dashboards keep customer impact, regional mitigation, and follow-up ownership visible while responsive cards change width.",
  },
  {
    ellipsis: "...",
    font: "16px Arial",
    name: "custom-cjk-word",
    text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任，同时避免关键短语被截断。",
  },
  {
    ellipsis: "[more]",
    font: "16px Arial",
    name: "custom-thai-word",
    text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
  },
  {
    boundary: "grapheme",
    ellipsis: "↗",
    font: "16px Arial",
    name: "custom-emoji-grapheme",
    text: "Status 👩🏽‍💻 ready, family 👨‍👩‍👧‍👦 notified, flags 🇺🇳🇯🇵 checked, and café e\u0301lan reviewed.",
  },
  {
    boundary: "grapheme",
    ellipsis: "...",
    font: "16px Arial",
    name: "custom-mixed-script-grapheme",
    text: "Incident تحديث 状態 update — 고객 영향, mitigación, and متابعة ownership remain visible.",
  },
  {
    boundary: "grapheme",
    ellipsis: "[more]",
    font: "16px Arial",
    name: "custom-long-token-grapheme",
    text: "observabilityPlatformBoundary👩‍🚀e\u0301".repeat(7),
  },
  {
    ellipsis: "",
    font: "16px Georgia",
    name: "custom-empty-word",
    text: "Release dashboards keep customer impact, regional mitigation, and follow-up ownership visible while responsive cards change width.",
  },
];

const scenarios = [...defaultScenarios, ...customEllipsisScenarios];

const edgeScenarios: readonly Scenario[] = [
  {
    font: "16px Georgia",
    name: "long-token",
    text: "observabilityPlatformBoundaryWithoutBreaks".repeat(7),
  },
];

function mountHost(scenario: Scenario, width: number): Host {
  const container = document.createElement("div");
  const root = document.createElement("div");
  const content = document.createElement("span");
  const body = document.createElement("span");
  const target = document.createElement("span");

  root.style.cssText = [
    "display:block",
    `font:${scenario.font}`,
    `line-height:${lineHeight}px`,
    "overflow:hidden",
    "overflow-wrap:break-word",
    "white-space:normal",
    `width:${width}px`,
  ].join(";");
  body.style.position = "relative";
  body.append(target);
  content.append(body);
  root.append(content);
  container.append(root);
  document.body.append(container);

  return { container, content, root, target };
}

function runBrowser(scenario: Scenario, widths: readonly number[], prepared: PreparedText): Run {
  const initialWidth = widths[0];
  if (initialWidth === undefined) throw new Error("Expected an initial width.");

  const host = mountHost(scenario, initialWidth);
  const getBoundingClientRect = host.content.getBoundingClientRect.bind(host.content);
  const getClientRects = host.content.getClientRects.bind(host.content);
  let boundingReads = 0;
  let clientReads = 0;
  Object.defineProperties(host.content, {
    getBoundingClientRect: {
      configurable: true,
      value: () => {
        boundingReads += 1;
        return getBoundingClientRect();
      },
    },
    getClientRects: {
      configurable: true,
      value: () => {
        clientReads += 1;
        return getClientRects();
      },
    },
  });

  const common = {
    content: host.content,
    ellipsis: scenario.ellipsis ?? "…",
    lineCapacity: lineLimit,
    lineLimit,
    maxHeight: undefined,
    prepared,
    ratio: 1,
    root: host.root,
    reuseFullFitOnGrow: true,
    simpleLineFit: { lineHeight },
    target: host.target,
  } as const;

  try {
    setElementText(host.target, scenario.text);
    let hint: TextClampResult | null = clampTextToLayout({
      ...common,
      hint: null,
      rootWidth: initialWidth,
    });
    if (!hint) throw new Error(`Could not initialize ${scenario.name}.`);

    boundingReads = 0;
    clientReads = 0;
    const texts: string[] = [];
    const start = performance.now();
    for (const width of widths.slice(1)) {
      host.root.style.width = `${width}px`;
      hint = clampTextToLayout({ ...common, hint, rootWidth: width });
      if (!hint) throw new Error(`Could not clamp ${scenario.name} at ${width}px.`);
      texts.push(hint.text);
    }

    return {
      layoutReads: boundingReads + clientReads,
      ms: performance.now() - start,
      texts,
    };
  } finally {
    host.container.remove();
  }
}

function runPretext(
  scenario: Scenario,
  widths: readonly number[],
  prepared: PreparedLineClamp,
): Run {
  const initialWidth = widths[0];
  if (initialWidth === undefined) throw new Error("Expected an initial width.");

  const host = mountHost(scenario, initialWidth);
  let visible = clampPreparedLine(prepared, initialWidth, lineLimit).text;
  setElementText(host.target, visible);

  try {
    const texts: string[] = [];
    const start = performance.now();
    for (const width of widths.slice(1)) {
      host.root.style.width = `${width}px`;
      const result = clampPreparedLine(prepared, width, lineLimit);
      if (result.text !== visible) {
        visible = result.text;
        setElementText(host.target, visible);
      }
      texts.push(result.text);
    }

    return { layoutReads: 0, ms: performance.now() - start, texts };
  } finally {
    host.container.remove();
  }
}

function runPretextCore(widths: readonly number[], prepared: PreparedLineClamp): CoreRun {
  let checksum = 0;
  const start = performance.now();

  for (let cycle = 0; cycle < coreCycles; cycle += 1) {
    for (const width of widths) {
      const result = clampPreparedLine(prepared, width, lineLimit);
      checksum += result.text.length + Number(result.clamped);
    }
  }

  return { checksum, ms: performance.now() - start };
}

function verifyPretextFits(
  scenario: Scenario,
  widths: readonly number[],
  texts: readonly string[],
) {
  const initialWidth = widths[0];
  if (initialWidth === undefined) throw new Error("Expected an initial width.");

  const host = mountHost(scenario, initialWidth);
  try {
    for (let index = 0; index < texts.length; index += 1) {
      const width = widths[index + 1];
      if (width === undefined) throw new Error("Expected a matching width.");
      host.root.style.width = `${width}px`;
      setElementText(host.target, texts[index]!);
      expect(host.root.scrollHeight, `${scenario.name} at ${width}px`).toBeLessThanOrEqual(
        lineLimit * lineHeight + 0.5,
      );
    }
  } finally {
    host.container.remove();
  }
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function settle(): Promise<void> {
  await nextTick();
  await frame();
  await nextTick();
}

async function runScaleScenario(widths: readonly number[]): Promise<ScaleMetrics> {
  let callbackCount = 0;
  let entryCount = 0;
  let instanceCount = 0;
  let mutationCount = 0;
  let vnodeUpdates = 0;
  globalThis.ResizeObserver = new Proxy(originalResizeObserver, {
    construct(Target, [callback]: ConstructorParameters<typeof ResizeObserver>) {
      instanceCount += 1;
      return new Target((entries, observer) => {
        callbackCount += 1;
        entryCount += entries.length;
        callback(entries, observer);
      });
    },
  });

  const container = document.createElement("div");
  document.body.append(container);
  const Host = defineComponent(
    () => () =>
      h(
        "div",
        { style: { width: `${widths[0] ?? 460}px` } },
        Array.from({ length: scaleInstances }, (_, index) =>
          h(LineClamp, {
            boundary: "word",
            key: index,
            maxLines: lineLimit,
            onVnodeUpdated: () => {
              vnodeUpdates += 1;
            },
            style: { font: "16px Arial", lineHeight: `${lineHeight}px`, width: "100%" },
            text: `Row ${index + 1} keeps customer impact, mitigation, ownership, and follow-up context visible while responsive dashboards resize.`,
          }),
        ),
      ),
  );
  const app: App = createApp(Host);

  try {
    app.mount(container);
    await settle();
    await frame();
    const host = container.firstElementChild;
    if (!(host instanceof HTMLElement)) throw new Error("Expected scale benchmark host.");

    callbackCount = 0;
    entryCount = 0;
    vnodeUpdates = 0;
    const mutationObserver = new MutationObserver((records) => {
      mutationCount += records.length;
    });
    mutationObserver.observe(container, { characterData: true, childList: true, subtree: true });

    const start = performance.now();
    for (const nextWidth of widths.slice(1)) {
      host.style.width = `${nextWidth}px`;
      await settle();
    }
    const resizeMs = performance.now() - start;
    mutationObserver.disconnect();

    return {
      callbackCount,
      entryCount,
      instanceCount,
      mutationCount,
      resizeMs,
      vnodeUpdates,
    };
  } finally {
    app.unmount();
    container.remove();
    globalThis.ResizeObserver = originalResizeObserver;
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function visiblePrefix(output: string, source: string, ellipsis: string): string | null {
  if (output === source) return source;
  if (!output.endsWith(ellipsis)) return null;

  const prefix = ellipsis.length === 0 ? output : output.slice(0, -ellipsis.length);
  return source.startsWith(prefix) ? prefix : null;
}

function graphemeCount(value: string): number {
  return [...graphemeSegmenter.segment(value)].length;
}

describe("Pretext LineClamp benchmark", () => {
  it("compares the browser and Pretext resize hot paths", () => {
    const results = scenarios.flatMap((scenario) => {
      const boundary = scenario.boundary ?? "word";
      const browserPrepared = prepareText(scenario.text, boundary);
      clearCache();
      const prepareStart = performance.now();
      const pretextPrepared = prepareLineClamp(scenario.text, scenario.font, {
        boundary,
        ...(scenario.ellipsis === undefined ? {} : { ellipsis: scenario.ellipsis }),
      });
      const prepareMs = performance.now() - prepareStart;

      return patterns.map((pattern) => {
        const browserRuns: Run[] = [];
        const coreRuns: CoreRun[] = [];
        const pretextRuns: Run[] = [];

        for (let repetition = 0; repetition < repetitions; repetition += 1) {
          if (repetition % 2 === 0) {
            browserRuns.push(runBrowser(scenario, pattern.widths, browserPrepared));
            pretextRuns.push(runPretext(scenario, pattern.widths, pretextPrepared));
            coreRuns.push(runPretextCore(pattern.widths, pretextPrepared));
          } else {
            coreRuns.push(runPretextCore(pattern.widths, pretextPrepared));
            pretextRuns.push(runPretext(scenario, pattern.widths, pretextPrepared));
            browserRuns.push(runBrowser(scenario, pattern.widths, browserPrepared));
          }
        }

        const browserTexts = browserRuns[0]?.texts ?? [];
        const pretextTexts = pretextRuns[0]?.texts ?? [];
        const marker = scenario.ellipsis ?? "…";
        const exactOutputs = pretextTexts.filter(
          (output, index) => output === browserTexts[index],
        ).length;
        const deficits: number[] = [];

        if (scenario.exact) {
          expect(pretextTexts).toEqual(browserTexts);
        }
        expect(pretextTexts).toHaveLength(browserTexts.length);
        for (let index = 0; index < pretextTexts.length; index += 1) {
          const pretextPrefix = visiblePrefix(pretextTexts[index]!, scenario.text, marker);
          const browserPrefix = visiblePrefix(browserTexts[index]!, scenario.text, marker);
          expect(
            pretextPrefix,
            `${scenario.name} ${pattern.name} at ${pattern.widths[index + 1]}px`,
          ).not.toBeNull();
          expect(
            browserPrefix,
            `${scenario.name} ${pattern.name} at ${pattern.widths[index + 1]}px`,
          ).not.toBeNull();
          expect(
            pretextPrefix!.length,
            `${scenario.name} ${pattern.name} at ${pattern.widths[index + 1]}px`,
          ).toBeLessThanOrEqual(browserPrefix!.length);
          expect(
            browserPrepared.fallbackBoundaryOffsets ?? browserPrepared.boundaryOffsets,
            `${scenario.name} ${pattern.name} at ${pattern.widths[index + 1]}px`,
          ).toContain(pretextPrefix!.length);
          deficits.push(graphemeCount(browserPrefix!) - graphemeCount(pretextPrefix!));
        }
        verifyPretextFits(scenario, pattern.widths, pretextTexts);
        const browserMs = median(browserRuns.map((run) => run.ms));
        const pretextMs = median(pretextRuns.map((run) => run.ms));

        return {
          browserLayoutReads: median(browserRuns.map((run) => run.layoutReads)),
          browserMs: round(browserMs),
          changes: pattern.widths.length - 1,
          coreChecksum: coreRuns[0]?.checksum,
          coreMsPer100k: round(
            (median(coreRuns.map((run) => run.ms)) * 100_000) /
              (pattern.widths.length * coreCycles),
          ),
          name: scenario.name,
          outputMatchPercent: round((exactOutputs / pretextTexts.length) * 100),
          pattern: pattern.name,
          pretextLayoutReads: 0,
          pretextMs: round(pretextMs),
          pretextPrepareMs: round(prepareMs),
          remainingTimePercent: round((pretextMs / browserMs) * 100),
          shorterOutputs: deficits.filter((deficit) => deficit > 0).length,
          worstGraphemeDeficit: Math.max(0, ...deficits),
        };
      });
    });

    expect(results).toHaveLength(scenarios.length * patterns.length);
    console.error(`PRETEXT_BENCH_RESULT ${JSON.stringify(results)}`);
  });

  it("reports component scheduling cost at scale", async () => {
    const scalePatterns = [
      { name: "smooth", widths: widthSweep(330, 306, -1) },
      {
        name: "jumps",
        widths: repeatedWidths([460, 320, 180, 280, 420, 240, 460], 4),
      },
    ] as const;
    const results = [];

    for (const pattern of scalePatterns) {
      const changes = pattern.widths
        .slice(1)
        .filter((width, index) => width !== pattern.widths[index]).length;
      const runs: ScaleMetrics[] = [];

      for (let repetition = 0; repetition < scaleRepetitions; repetition += 1) {
        runs.push(await runScaleScenario(pattern.widths));
      }

      const summary = {
        callbackCount: median(runs.map((run) => run.callbackCount)),
        changes,
        entryCount: median(runs.map((run) => run.entryCount)),
        instances: scaleInstances,
        mutationCount: median(runs.map((run) => run.mutationCount)),
        observerInstances: median(runs.map((run) => run.instanceCount)),
        resizeMs: round(median(runs.map((run) => run.resizeMs))),
        vnodeUpdates: median(runs.map((run) => run.vnodeUpdates)),
      };

      expect(summary.entryCount).toBe(scaleInstances * changes);
      expect(summary.callbackCount).toBe(scaleInstances * changes);
      expect(summary.observerInstances).toBe(scaleInstances);
      results.push({ name: pattern.name, runs, summary });
    }

    console.error(`PRETEXT_SCALE_BENCH_RESULT ${JSON.stringify(results)}`);
  });

  it("reports core throughput for breakable edge cases", () => {
    const results = edgeScenarios.flatMap((scenario) => {
      clearCache();
      const prepareStart = performance.now();
      const prepared = prepareLineClamp(scenario.text, scenario.font, {
        ...(scenario.boundary === undefined ? {} : { boundary: scenario.boundary }),
        ...(scenario.ellipsis === undefined ? {} : { ellipsis: scenario.ellipsis }),
      });
      const prepareMs = performance.now() - prepareStart;

      return patterns.map((pattern) => {
        const runs = Array.from({ length: repetitions }, () =>
          runPretextCore(pattern.widths, prepared),
        );

        return {
          checksum: runs[0]?.checksum,
          coreMsPer100k: round(
            (median(runs.map((run) => run.ms)) * 100_000) / (pattern.widths.length * coreCycles),
          ),
          name: scenario.name,
          pattern: pattern.name,
          prepareMs: round(prepareMs),
        };
      });
    });

    expect(results).toHaveLength(edgeScenarios.length * patterns.length);
    console.error(`PRETEXT_CORE_EDGE_BENCH_RESULT ${JSON.stringify(results)}`);
  });

  it("decomposes repeated preparation cost", () => {
    const texts = Array.from(
      { length: preparationCount },
      (_, index) =>
        `Row ${index + 1} keeps customer impact, mitigation, ownership, and follow-up visible.`,
    );
    const runs = {
      boundaries: [] as number[],
      pretext: [] as number[],
      wrapper: [] as number[],
    };
    let checksum = 0;

    clearCache();
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const pretextStart = performance.now();
      for (const text of texts) {
        checksum += prepareWithSegments(text, "16px Arial").segments.length;
      }
      runs.pretext.push(performance.now() - pretextStart);

      const boundariesStart = performance.now();
      for (const text of texts) {
        checksum += prepareText(text, "word").boundaryOffsets.length;
      }
      runs.boundaries.push(performance.now() - boundariesStart);

      const wrapperStart = performance.now();
      for (const text of texts) {
        checksum += prepareLineClamp(text, "16px Arial").segmentBoundaryRanks.length;
      }
      runs.wrapper.push(performance.now() - wrapperStart);
    }

    expect(checksum).toBeGreaterThan(0);
    console.error(
      `PRETEXT_PREPARE_BREAKDOWN ${JSON.stringify({
        count: preparationCount,
        paths: Object.fromEntries(
          Object.entries(runs).map(([name, values]) => [
            name,
            { ms: round(median(values)), runs: values.map(round) },
          ]),
        ),
      })}`,
    );
  });
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  document.body.innerHTML = "";
});
