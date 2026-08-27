import { clearCache } from "@chenglou/pretext";
import { createApp, defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { clampTextToLayout, prepareText, setElementText } from "../src/text.ts";
import { LineClamp } from "../src/pretext.ts";
import { clampPreparedLine, prepareLineClamp } from "../src/pretext/clamp.ts";

import type { App } from "vue";
import type { PreparedText, TextClampResult } from "../src/text.ts";
import type { PreparedLineClamp } from "../src/pretext/clamp.ts";

type Scenario = {
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
  readonly mountMs: number;
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

const scenarios: readonly Scenario[] = [
  {
    font: "16px Georgia",
    name: "english",
    text: "Release dashboards keep customer impact, regional mitigation, and follow-up ownership visible while responsive cards change width.",
  },
  {
    font: "16px Arial",
    name: "cjk",
    text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任，同时避免关键短语被截断。",
  },
  {
    font: "16px Arial",
    name: "thai",
    text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
  },
];

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
    ellipsis: "…",
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
            font: "16px Arial",
            key: index,
            maxLines: lineLimit,
            onVnodeUpdated: () => {
              vnodeUpdates += 1;
            },
            style: { lineHeight: `${lineHeight}px`, width: "100%" },
            text: `Row ${index + 1} keeps customer impact, mitigation, ownership, and follow-up context visible while responsive dashboards resize.`,
          }),
        ),
      ),
  );
  const app: App = createApp(Host);

  try {
    const mountStart = performance.now();
    app.mount(container);
    await settle();
    await frame();
    const mountMs = performance.now() - mountStart;
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
      mountMs,
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

describe("Pretext LineClamp benchmark", () => {
  it("compares the browser and Pretext resize hot paths", () => {
    const results = scenarios.flatMap((scenario) => {
      const browserPrepared = prepareText(scenario.text, "word");
      clearCache();
      const prepareStart = performance.now();
      const pretextPrepared = prepareLineClamp(scenario.text, scenario.font);
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

        expect(pretextRuns[0]?.texts).toEqual(browserRuns[0]?.texts);
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
          pattern: pattern.name,
          pretextLayoutReads: 0,
          pretextMs: round(pretextMs),
          pretextPrepareMs: round(prepareMs),
          remainingTimePercent: round((pretextMs / browserMs) * 100),
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
        mountMs: round(median(runs.map((run) => run.mountMs))),
        mutationCount: median(runs.map((run) => run.mutationCount)),
        observerInstances: median(runs.map((run) => run.instanceCount)),
        resizeMs: round(median(runs.map((run) => run.resizeMs))),
        vnodeUpdates: median(runs.map((run) => run.vnodeUpdates)),
      };

      expect(summary.entryCount).toBe(scaleInstances * changes);
      expect(summary.callbackCount).toBe(changes);
      expect(summary.observerInstances).toBe(1);
      results.push({ name: pattern.name, runs, summary });
    }

    console.error(`PRETEXT_SCALE_BENCH_RESULT ${JSON.stringify(results)}`);
  });

  it("reports core throughput for breakable edge cases", () => {
    const results = edgeScenarios.flatMap((scenario) => {
      clearCache();
      const prepareStart = performance.now();
      const prepared = prepareLineClamp(scenario.text, scenario.font);
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

  it("reports repeated preparation throughput", () => {
    const texts = Array.from(
      { length: preparationCount },
      (_, index) =>
        `Row ${index + 1} keeps customer impact, mitigation, ownership, and follow-up visible.`,
    );
    const runs = [];
    let checksum = 0;

    clearCache();
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const start = performance.now();
      for (const text of texts) {
        const prepared = prepareLineClamp(text, "16px Arial");
        checksum += prepared.boundaries.boundaryOffsets.length;
      }
      runs.push(performance.now() - start);
    }

    expect(checksum).toBeGreaterThan(0);
    console.error(
      `PRETEXT_PREPARE_BENCH_RESULT ${JSON.stringify({
        count: preparationCount,
        ms: round(median(runs)),
        runs: runs.map(round),
      })}`,
    );
  });
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  document.body.innerHTML = "";
});
