import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp } from "../src/index.ts";
import * as textHelpers from "../src/text.ts";

import type { App, Ref } from "vue";

type BenchmarkMetrics = {
  boundingRectReads: number;
  clientRectReads: number;
  scrollWidthReads: number;
};

type BenchmarkRun = BenchmarkMetrics & {
  meanStepMs: number;
  steps: number;
  totalMs: number;
};

type BenchmarkSummary = {
  medianBoundingRectReads: number;
  medianClientRectReads: number;
  medianMeanStepMs: number;
  medianScrollWidthReads: number;
  medianTotalMs: number;
  runs: BenchmarkRun[];
  steps: number;
};

type ScenarioResult = {
  scenario: string;
  summary: BenchmarkSummary;
};

type TextClampHint = {
  boundaryOffsets: readonly number[];
  kept: number;
};

type TextClampResult = TextClampHint & {
  text: string;
};

type PreparedText = ReturnType<typeof textHelpers.prepareText>;

type TextModule = typeof textHelpers & Record<string, unknown>;

type InlineHost = {
  body: HTMLElement;
  container: HTMLElement;
  root: HTMLElement;
  setWidth: (width: number) => void;
};

type LineHost = InlineHost & {
  content: HTMLElement;
  text: HTMLElement;
};

type ComponentHost = {
  app: App;
  container: HTMLElement;
  root: HTMLElement;
  width: Ref<number>;
};

type DirectScenarioSpec = {
  cache: "cold" | "warm";
  kind: "inline" | "line";
  name: string;
  widths: readonly number[];
};

type ComponentScenarioSpec = {
  kind: "inline" | "line";
  name: string;
  widths: readonly number[];
};

type ScrollWidthDescriptor = {
  descriptor: PropertyDescriptor;
  owner: object;
};

const benchmarkWarmupRuns = 1;
const benchmarkMeasuredRuns = 5;
const trackedRoots: HTMLElement[] = [];
let trackedMetrics: BenchmarkMetrics | null = null;

const originalGetBoundingClientRectDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getBoundingClientRect",
);
const originalGetBoundingClientRect = originalGetBoundingClientRectDescriptor?.value as
  | ((this: Element) => DOMRect)
  | undefined;
const originalGetClientRectsDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getClientRects",
);
const originalGetClientRects = originalGetClientRectsDescriptor?.value as
  | ((this: Element) => DOMRectList)
  | undefined;
const originalScrollWidthDescriptor = propertyDescriptorInPrototypeChain(
  HTMLElement.prototype,
  "scrollWidth",
);

const lineText = Array.from(
  { length: 12 },
  (_, index) =>
    `Segment ${index + 1} keeps the clamp busy while layout changes by small increments.`,
).join(" ");
const inlineText =
  "/workspace/packages/vue-clamp/src/components/very-long-generated-artifact-name.browser.test.ts";

const lineWidthPatterns = {
  continuous: [...widthSweep(460, 180, -1), ...widthSweep(181, 460, 1)],
  jitter: jitterWidths(281, 330, 180, 460, 19, 0x42),
  jumps: repeatedWidths([460, 180, 440, 200, 420, 160, 450, 230, 390, 190, 460], 10),
};
const inlineWidthPatterns = {
  continuous: [...widthSweep(320, 90, -1), ...widthSweep(91, 320, 1)],
  jitter: jitterWidths(231, 220, 90, 320, 13, 0x91),
  jumps: repeatedWidths([320, 90, 300, 120, 280, 100, 310, 150, 250, 95, 320], 10),
};
const componentWidthPatterns = {
  inlineContinuous: [...widthSweep(320, 90, -4), ...widthSweep(94, 320, 4)],
  inlineJumps: repeatedWidths([320, 90, 300, 120, 280, 100, 320], 4),
  lineContinuous: [...widthSweep(460, 180, -4), ...widthSweep(184, 460, 4)],
  lineJumps: repeatedWidths([460, 180, 440, 200, 420, 160, 460], 4),
};

function propertyDescriptorInPrototypeChain(
  start: object,
  property: string,
): ScrollWidthDescriptor | null {
  let current: object | null = start;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) {
      return {
        descriptor,
        owner: current,
      };
    }

    current = Object.getPrototypeOf(current) as object | null;
  }

  return null;
}

function textModule(): TextModule {
  return textHelpers as TextModule;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function summarize(runs: BenchmarkRun[]): BenchmarkSummary {
  return {
    medianBoundingRectReads: median(runs.map((run) => run.boundingRectReads)),
    medianClientRectReads: median(runs.map((run) => run.clientRectReads)),
    medianMeanStepMs: median(runs.map((run) => run.meanStepMs)),
    medianScrollWidthReads: median(runs.map((run) => run.scrollWidthReads)),
    medianTotalMs: median(runs.map((run) => run.totalMs)),
    runs,
    steps: runs[0]?.steps ?? 0,
  };
}

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

function isTrackedElement(element: Element): boolean {
  return trackedRoots.some((root) => element === root || root.contains(element));
}

function emptyMetrics(): BenchmarkMetrics {
  return {
    boundingRectReads: 0,
    clientRectReads: 0,
    scrollWidthReads: 0,
  };
}

function beginTracking(...roots: HTMLElement[]): void {
  trackedRoots.length = 0;
  trackedRoots.push(...roots);
  trackedMetrics = emptyMetrics();
}

function endTracking(): BenchmarkMetrics {
  const metrics = trackedMetrics ?? emptyMetrics();
  trackedMetrics = null;
  trackedRoots.length = 0;
  return metrics;
}

function resultFrom(value: unknown, prepared: PreparedText): TextClampResult | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return {
      boundaryOffsets: prepared.boundaryOffsets,
      kept: Number.NaN,
      text: value,
    };
  }

  return value as TextClampResult;
}

function clampTextToFit({
  ellipsis,
  fits,
  hint,
  prepared,
  ratio,
  spacing,
}: {
  ellipsis: string;
  fits: (text: string) => boolean;
  hint: TextClampHint | null;
  prepared: PreparedText;
  ratio: number;
  spacing: "trim" | "preserve-outer";
}): TextClampResult {
  const module = textModule();
  const clamp =
    module.clampTextToFit ??
    (() => {
      throw new Error("Missing text fit helper.");
    });
  const result = resultFrom(
    (clamp as (...args: unknown[]) => unknown)({
      ellipsis,
      fits,
      hint,
      prepared,
      ratio,
      spacing,
    }),
    prepared,
  );

  if (!result) {
    throw new Error("Text fit helper returned null.");
  }

  return result;
}

function clampTextToLayout(
  prepared: PreparedText,
  host: LineHost,
  ratio: number,
  maxLines: number,
  hint: TextClampHint | null,
): TextClampResult | null {
  const result = (textModule().clampTextToLayout as (...args: unknown[]) => unknown)({
    content: host.content,
    ellipsis: "…",
    hint,
    lineLimit: maxLines,
    maxHeight: undefined,
    prepared,
    ratio,
    root: host.root,
    target: host.text,
  });

  return resultFrom(result, prepared);
}

function sharedTextStyle(width: number): string {
  return [
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    "overflow-wrap:break-word",
  ].join(";");
}

function lineStyle(width: number): string {
  return ["display:block", "white-space:normal", sharedTextStyle(width)].join(";");
}

function inlineStyle(width: number): string {
  return sharedTextStyle(width);
}

function mountLineHost(width: number): LineHost {
  const container = document.createElement("div");
  document.body.append(container);

  const root = document.createElement("div");
  root.style.cssText = lineStyle(width);

  const content = document.createElement("span");
  const body = document.createElement("span");
  const text = document.createElement("span");

  body.style.position = "relative";
  body.append(text);
  content.append(body);
  root.append(content);
  container.append(root);

  return {
    body,
    container,
    content,
    root,
    setWidth: (nextWidth) => {
      root.style.width = `${nextWidth}px`;
    },
    text,
  };
}

function mountInlineHost(width: number): InlineHost {
  const container = document.createElement("div");
  container.style.cssText = lineStyle(width);
  document.body.append(container);

  const root = document.createElement("span");
  root.style.cssText = [
    "display:inline-block",
    "max-width:100%",
    "min-width:0",
    "overflow:hidden",
    "position:relative",
    "white-space:nowrap",
    "vertical-align:baseline",
  ].join(";");

  const body = document.createElement("span");
  root.append(body);
  container.append(root);

  return {
    body,
    container,
    root,
    setWidth: (nextWidth) => {
      container.style.width = `${nextWidth}px`;
    },
  };
}

function runInlineClamp(
  prepared: PreparedText,
  host: InlineHost,
  ratio: number,
  hint: TextClampHint | null,
): TextClampResult | null {
  host.body.textContent = prepared.text;

  const limit = host.root.getBoundingClientRect().width;
  if (limit <= 0) {
    return null;
  }

  const fits = (): boolean => host.root.scrollWidth <= limit + 0.5;

  if (fits()) {
    return {
      boundaryOffsets: prepared.boundaryOffsets,
      kept: prepared.boundaryOffsets.length - 1,
      text: prepared.text,
    };
  }

  const result = clampTextToFit({
    ellipsis: "…",
    fits: (candidate: string) => {
      host.body.textContent = candidate;
      return fits();
    },
    prepared,
    ratio,
    spacing: "preserve-outer",
    hint,
  });
  host.body.textContent = result.text;
  return result;
}

function runDirectScenario(spec: DirectScenarioSpec): BenchmarkRun {
  const prepared = textHelpers.prepareText(
    spec.kind === "line" ? lineText : inlineText,
    "grapheme",
  );
  const firstWidth = spec.widths[0];
  if (firstWidth === undefined) {
    throw new Error(`Scenario ${spec.name} must provide at least one width.`);
  }

  const host = spec.kind === "line" ? mountLineHost(firstWidth) : mountInlineHost(firstWidth);
  let hint: TextClampResult | null = null;

  try {
    hint =
      spec.kind === "line"
        ? clampTextToLayout(prepared, host as LineHost, 1, 3, hint)
        : runInlineClamp(prepared, host, 0.5, hint);
    beginTracking(host.root);

    let totalMs = 0;
    const measuredWidths = spec.widths.slice(1);

    for (const width of measuredWidths) {
      const start = performance.now();
      host.setWidth(width);
      const nextHint = spec.cache === "warm" ? hint : null;
      hint =
        spec.kind === "line"
          ? clampTextToLayout(prepared, host as LineHost, 1, 3, nextHint)
          : runInlineClamp(prepared, host, 0.5, nextHint);
      totalMs += performance.now() - start;

      if (!hint) {
        throw new Error(`${spec.name} benchmark returned null.`);
      }
    }

    const metrics = endTracking();
    return {
      ...metrics,
      meanStepMs: totalMs / measuredWidths.length,
      steps: measuredWidths.length,
      totalMs,
    };
  } finally {
    endTracking();
    host.container.remove();
  }
}

function rootElement(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected benchmark component root.");
  }

  return root;
}

async function flushComponentUpdate(): Promise<void> {
  await nextTick();
  await nextTick();
}

async function mountComponentHost(spec: ComponentScenarioSpec): Promise<ComponentHost> {
  const firstWidth = spec.widths[0];
  if (firstWidth === undefined) {
    throw new Error(`Scenario ${spec.name} must provide at least one width.`);
  }

  const width = ref(firstWidth);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        spec.kind === "line"
          ? h(LineClamp, {
              maxLines: 3,
              style: lineStyle(width.value),
              text: lineText,
            })
          : h(InlineClamp, {
              location: "middle",
              style: inlineStyle(width.value),
              text: inlineText,
            });
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushComponentUpdate();

  return {
    app,
    container,
    root: rootElement(container),
    width,
  };
}

async function runComponentScenario(spec: ComponentScenarioSpec): Promise<BenchmarkRun> {
  const host = await mountComponentHost(spec);

  try {
    beginTracking(host.root);

    let totalMs = 0;
    const measuredWidths = spec.widths.slice(1);

    for (const width of measuredWidths) {
      const start = performance.now();
      host.width.value = width;
      await flushComponentUpdate();
      totalMs += performance.now() - start;
    }

    const metrics = endTracking();
    return {
      ...metrics,
      meanStepMs: totalMs / measuredWidths.length,
      steps: measuredWidths.length,
      totalMs,
    };
  } finally {
    endTracking();
    host.app.unmount();
    host.container.remove();
  }
}

async function runBenchmark(
  runScenario: () => BenchmarkRun | Promise<BenchmarkRun>,
): Promise<BenchmarkSummary> {
  const runs: BenchmarkRun[] = [];

  for (let runIndex = 0; runIndex < benchmarkWarmupRuns + benchmarkMeasuredRuns; runIndex += 1) {
    const run = await runScenario();

    if (runIndex >= benchmarkWarmupRuns) {
      runs.push(run);
    }
  }

  return summarize(runs);
}

function directScenarios(): DirectScenarioSpec[] {
  return [
    {
      cache: "cold",
      kind: "line",
      name: "direct-line-continuous-cold",
      widths: lineWidthPatterns.continuous,
    },
    {
      cache: "warm",
      kind: "line",
      name: "direct-line-continuous-warm",
      widths: lineWidthPatterns.continuous,
    },
    {
      cache: "cold",
      kind: "line",
      name: "direct-line-jitter-cold",
      widths: lineWidthPatterns.jitter,
    },
    {
      cache: "warm",
      kind: "line",
      name: "direct-line-jitter-warm",
      widths: lineWidthPatterns.jitter,
    },
    {
      cache: "cold",
      kind: "line",
      name: "direct-line-jumps-cold",
      widths: lineWidthPatterns.jumps,
    },
    {
      cache: "warm",
      kind: "line",
      name: "direct-line-jumps-warm",
      widths: lineWidthPatterns.jumps,
    },
    {
      cache: "cold",
      kind: "inline",
      name: "direct-inline-continuous-cold",
      widths: inlineWidthPatterns.continuous,
    },
    {
      cache: "warm",
      kind: "inline",
      name: "direct-inline-continuous-warm",
      widths: inlineWidthPatterns.continuous,
    },
    {
      cache: "cold",
      kind: "inline",
      name: "direct-inline-jitter-cold",
      widths: inlineWidthPatterns.jitter,
    },
    {
      cache: "warm",
      kind: "inline",
      name: "direct-inline-jitter-warm",
      widths: inlineWidthPatterns.jitter,
    },
    {
      cache: "cold",
      kind: "inline",
      name: "direct-inline-jumps-cold",
      widths: inlineWidthPatterns.jumps,
    },
    {
      cache: "warm",
      kind: "inline",
      name: "direct-inline-jumps-warm",
      widths: inlineWidthPatterns.jumps,
    },
  ];
}

function componentScenarios(): ComponentScenarioSpec[] {
  return [
    {
      kind: "line",
      name: "component-line-continuous",
      widths: componentWidthPatterns.lineContinuous,
    },
    {
      kind: "line",
      name: "component-line-jumps",
      widths: componentWidthPatterns.lineJumps,
    },
    {
      kind: "inline",
      name: "component-inline-continuous",
      widths: componentWidthPatterns.inlineContinuous,
    },
    {
      kind: "inline",
      name: "component-inline-jumps",
      widths: componentWidthPatterns.inlineJumps,
    },
  ];
}

beforeAll(() => {
  if (!originalGetBoundingClientRect || !originalGetClientRects) {
    throw new Error("Missing element rect methods for benchmark setup.");
  }

  Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect(
    this: Element,
  ): DOMRect {
    if (trackedMetrics && isTrackedElement(this)) {
      trackedMetrics.boundingRectReads += 1;
    }

    return originalGetBoundingClientRect.call(this);
  };

  Element.prototype.getClientRects = function patchedGetClientRects(this: Element): DOMRectList {
    if (trackedMetrics && isTrackedElement(this)) {
      trackedMetrics.clientRectReads += 1;
    }

    return originalGetClientRects.call(this);
  };

  if (originalScrollWidthDescriptor?.descriptor.get) {
    Object.defineProperty(originalScrollWidthDescriptor.owner, "scrollWidth", {
      ...originalScrollWidthDescriptor.descriptor,
      get(this: HTMLElement): number {
        if (trackedMetrics && isTrackedElement(this)) {
          trackedMetrics.scrollWidthReads += 1;
        }

        return originalScrollWidthDescriptor.descriptor.get!.call(this) as number;
      },
    });
  }
});

afterEach(() => {
  trackedRoots.length = 0;
  trackedMetrics = null;
  document.body.innerHTML = "";
});

afterAll(() => {
  if (originalGetBoundingClientRectDescriptor) {
    Object.defineProperty(
      Element.prototype,
      "getBoundingClientRect",
      originalGetBoundingClientRectDescriptor,
    );
  }

  if (originalGetClientRectsDescriptor) {
    Object.defineProperty(Element.prototype, "getClientRects", originalGetClientRectsDescriptor);
  }

  if (originalScrollWidthDescriptor) {
    Object.defineProperty(
      originalScrollWidthDescriptor.owner,
      "scrollWidth",
      originalScrollWidthDescriptor.descriptor,
    );
  }
});

describe("Text clamp benchmark", () => {
  it("reports direct and component text clamp workloads", async () => {
    const results: ScenarioResult[] = [];

    for (const scenario of directScenarios()) {
      results.push({
        scenario: scenario.name,
        summary: await runBenchmark(() => runDirectScenario(scenario)),
      });
    }

    for (const scenario of componentScenarios()) {
      results.push({
        scenario: scenario.name,
        summary: await runBenchmark(() => runComponentScenario(scenario)),
      });
    }

    console.error(`TEXT_BENCHMARK ${JSON.stringify({ scenarios: results })}`);

    expect(results).toHaveLength(directScenarios().length + componentScenarios().length);
    for (const result of results) {
      expect(result.summary.runs).toHaveLength(benchmarkMeasuredRuns);
    }
  });
});
