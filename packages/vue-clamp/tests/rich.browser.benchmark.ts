import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { RichLineClamp } from "../src/index.ts";
import { clampRichTextToLayout, prepareRichText } from "../src/rich.ts";
import { frame } from "./browser.ts";

import type { App, Ref } from "vue";
import type { RichClampDecision } from "../src/rich.ts";

type BenchmarkMetrics = {
  boundingRectReads: number;
  clientRectReads: number;
  cloneNodeCalls: number;
  imageCloneCalls: number;
  replaceChildrenCalls: number;
};

type BenchmarkRun = BenchmarkMetrics & {
  meanStepMs: number;
  steps: number;
  totalMs: number;
};

type BenchmarkSummary = {
  medianBoundingRectReads: number;
  medianClientRectReads: number;
  medianCloneNodeCalls: number;
  medianImageCloneCalls: number;
  medianMeanStepMs: number;
  medianReplaceChildrenCalls: number;
  medianTotalMs: number;
  runs: BenchmarkRun[];
  steps: number;
};

type DirectScenarioSpec = {
  cache: "cold" | "warm";
  htmls: string[];
  maxLines: number;
  name: string;
  widths: readonly number[];
};

type ComponentScenarioSpec = {
  html: string;
  maxLines: number;
  name: string;
  widths: readonly number[];
};

type ScenarioResult = {
  scenario: string;
  summary: BenchmarkSummary;
};

type MountedHost = {
  container: HTMLElement;
  content: HTMLElement;
  decision: RichClampDecision | null;
  destroy: () => void;
  rich: HTMLElement;
  root: HTMLElement;
  setWidth: (width: number) => void;
};

type ComponentHost = {
  app: App;
  container: HTMLElement;
  root: HTMLElement;
  width: Ref<number>;
};

type TrackingMetrics = BenchmarkMetrics;

const RICH_TEXT_HTML =
  '<strong>Vue</strong> ships <img alt="" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2212%22 viewBox=%220 0 24 12%22%3E%3Crect width=%2224%22 height=%2212%22 rx=%226%22 fill=%22%23005BD2%22/%3E%3C/svg%3E" style="width:24px;height:12px;vertical-align:baseline" /> <a href="/docs">layout-aware rich text clamping</a> for <em>inline content</em> and trailing markup.';
const ARTICLE_HTML =
  '<strong>Design systems</strong> need <a href="/guides"><em>predictable</em> truncation</a> when inline badges, <code>code</code>, and <span style="white-space:nowrap">non-breaking phrases</span> share the same paragraph.';
const richWidthPatterns = {
  continuous: [...widthSweep(360, 140, -1), ...widthSweep(141, 360, 1)],
  jitter: jitterWidths(241, 260, 140, 360, 21, 0x65),
  jumps: repeatedWidths([360, 140, 340, 160, 320, 180, 350, 150, 360], 10),
};
const denseWidthPatterns = {
  jumps: [260, 220, 180, 140, 180, 220, 260],
};
const componentWidthPatterns = {
  continuous: [...widthSweep(360, 140, -4), ...widthSweep(144, 360, 4)],
  jumps: repeatedWidths([360, 140, 340, 160, 320, 180, 360], 4),
};
const benchmarkWarmupRuns = 1;
const benchmarkMeasuredRuns = 4;
const trackedRoots: HTMLElement[] = [];
let trackedMetrics: TrackingMetrics | null = null;

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
const originalReplaceChildrenDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "replaceChildren",
);
const originalReplaceChildren = originalReplaceChildrenDescriptor?.value as
  | ((this: Element, ...nodes: (Node | string)[]) => void)
  | undefined;
const originalCloneNodeDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "cloneNode");
const originalCloneNode = originalCloneNodeDescriptor?.value as
  | ((this: Node, deep?: boolean) => Node)
  | undefined;

function hostStyle(width: number): string {
  return [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    "white-space:normal",
    "overflow-wrap:break-word",
  ].join(";");
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
    medianCloneNodeCalls: median(runs.map((run) => run.cloneNodeCalls)),
    medianImageCloneCalls: median(runs.map((run) => run.imageCloneCalls)),
    medianMeanStepMs: median(runs.map((run) => run.meanStepMs)),
    medianReplaceChildrenCalls: median(runs.map((run) => run.replaceChildrenCalls)),
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

function emptyTrackingMetrics(): TrackingMetrics {
  return {
    boundingRectReads: 0,
    clientRectReads: 0,
    cloneNodeCalls: 0,
    imageCloneCalls: 0,
    replaceChildrenCalls: 0,
  };
}

function beginTracking(roots: readonly HTMLElement[]): void {
  trackedRoots.length = 0;
  trackedRoots.push(...roots);
  trackedMetrics = emptyTrackingMetrics();
}

function endTracking(): TrackingMetrics {
  const metrics = trackedMetrics ?? emptyTrackingMetrics();
  trackedMetrics = null;
  trackedRoots.length = 0;
  return metrics;
}

function makeTableHtmls(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const row = index + 1;
    return `<strong>Row ${row}</strong> includes <a href="/rows/${row}">inline <em>metadata</em></a>, <span style="display:inline-block">badge ${row}</span>, and trailing summary copy that may need truncation.`;
  });
}

function mountHost(html: string, width: number): MountedHost {
  const container = document.createElement("div");
  container.style.cssText = "display:block;padding:0;margin:0;";
  document.body.append(container);

  const root = document.createElement("div");
  root.dataset.part = "root";
  root.style.cssText = hostStyle(width);

  const content = document.createElement("span");
  content.dataset.part = "content";

  const body = document.createElement("span");
  body.dataset.part = "body";
  body.innerHTML = html;
  content.append(body);
  root.append(content);
  container.append(root);

  return {
    container,
    content,
    decision: null,
    destroy: () => {
      container.remove();
    },
    rich: body,
    root,
    setWidth: (nextWidth) => {
      root.style.width = `${nextWidth}px`;
    },
  };
}

function runClamp(
  prepared: NonNullable<ReturnType<typeof prepareRichText>>,
  host: MountedHost,
  maxLines: number,
  searchDecision: RichClampDecision | null,
): void {
  const clamp = clampRichTextToLayout as unknown as (...args: unknown[]) => {
    decision: RichClampDecision | null;
    fallback: boolean;
  };
  const result =
    clamp.length >= 9
      ? clamp(
          prepared,
          host.root,
          host.content,
          host.rich,
          host.decision,
          searchDecision,
          "…",
          maxLines,
          undefined,
        )
      : clamp(
          prepared,
          host.root,
          host.content,
          host.rich,
          host.decision,
          "…",
          maxLines,
          undefined,
        );
  host.decision = result.decision;

  if (!result.decision) {
    throw new Error("Rich benchmark returned null decision.");
  }
}

async function runDirectScenario(spec: DirectScenarioSpec): Promise<BenchmarkRun> {
  const initialWidth = spec.widths[0];
  if (initialWidth === undefined) {
    throw new Error(`Scenario ${spec.name} must provide at least one width.`);
  }

  const hosts = spec.htmls.map((html) => mountHost(html, initialWidth));

  try {
    await frame();

    const prepared = spec.htmls.map((html) => {
      const nextPrepared = prepareRichText(html);
      if (!nextPrepared) {
        throw new Error(`Rich benchmark could not prepare html for ${spec.name}.`);
      }
      return nextPrepared;
    });

    for (let index = 0; index < hosts.length; index += 1) {
      runClamp(prepared[index]!, hosts[index]!, spec.maxLines, null);
    }

    beginTracking([...hosts.map((host) => host.root), ...prepared.map((source) => source.root)]);

    let totalMs = 0;
    const measuredWidths = spec.widths.slice(1);

    for (const width of measuredWidths) {
      const startedAt = performance.now();

      for (const host of hosts) {
        host.setWidth(width);
      }

      for (let index = 0; index < hosts.length; index += 1) {
        runClamp(
          prepared[index]!,
          hosts[index]!,
          spec.maxLines,
          spec.cache === "warm" ? hosts[index]!.decision : null,
        );
      }

      totalMs += performance.now() - startedAt;
    }

    const tracked = endTracking();

    return {
      boundingRectReads: tracked.boundingRectReads,
      clientRectReads: tracked.clientRectReads,
      cloneNodeCalls: tracked.cloneNodeCalls,
      imageCloneCalls: tracked.imageCloneCalls,
      meanStepMs: totalMs / Math.max(1, measuredWidths.length),
      replaceChildrenCalls: tracked.replaceChildrenCalls,
      steps: measuredWidths.length,
      totalMs,
    };
  } finally {
    endTracking();

    for (const host of hosts) {
      host.destroy();
    }
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
        h(RichLineClamp, {
          html: spec.html,
          maxLines: spec.maxLines,
          style: hostStyle(width.value),
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
    beginTracking([host.root]);

    let totalMs = 0;
    const measuredWidths = spec.widths.slice(1);

    for (const width of measuredWidths) {
      const startedAt = performance.now();
      host.width.value = width;
      await flushComponentUpdate();
      totalMs += performance.now() - startedAt;
    }

    const tracked = endTracking();

    return {
      boundingRectReads: tracked.boundingRectReads,
      clientRectReads: tracked.clientRectReads,
      cloneNodeCalls: tracked.cloneNodeCalls,
      imageCloneCalls: tracked.imageCloneCalls,
      meanStepMs: totalMs / Math.max(1, measuredWidths.length),
      replaceChildrenCalls: tracked.replaceChildrenCalls,
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
      htmls: [ARTICLE_HTML],
      maxLines: 5,
      name: "direct-rich-fit-cold",
      widths: [760, 720, 680, 640, 600, 640, 680, 720, 760],
    },
    {
      cache: "warm",
      htmls: [ARTICLE_HTML],
      maxLines: 5,
      name: "direct-rich-fit-warm",
      widths: [760, 720, 680, 640, 600, 640, 680, 720, 760],
    },
    {
      cache: "cold",
      htmls: [RICH_TEXT_HTML],
      maxLines: 2,
      name: "direct-rich-continuous-cold",
      widths: richWidthPatterns.continuous,
    },
    {
      cache: "warm",
      htmls: [RICH_TEXT_HTML],
      maxLines: 2,
      name: "direct-rich-continuous-warm",
      widths: richWidthPatterns.continuous,
    },
    {
      cache: "cold",
      htmls: [RICH_TEXT_HTML],
      maxLines: 2,
      name: "direct-rich-jitter-cold",
      widths: richWidthPatterns.jitter,
    },
    {
      cache: "warm",
      htmls: [RICH_TEXT_HTML],
      maxLines: 2,
      name: "direct-rich-jitter-warm",
      widths: richWidthPatterns.jitter,
    },
    {
      cache: "cold",
      htmls: [RICH_TEXT_HTML],
      maxLines: 2,
      name: "direct-rich-jumps-cold",
      widths: richWidthPatterns.jumps,
    },
    {
      cache: "warm",
      htmls: [RICH_TEXT_HTML],
      maxLines: 2,
      name: "direct-rich-jumps-warm",
      widths: richWidthPatterns.jumps,
    },
    {
      cache: "cold",
      htmls: makeTableHtmls(40),
      maxLines: 2,
      name: "direct-rich-dense-jumps-cold",
      widths: denseWidthPatterns.jumps,
    },
    {
      cache: "warm",
      htmls: makeTableHtmls(40),
      maxLines: 2,
      name: "direct-rich-dense-jumps-warm",
      widths: denseWidthPatterns.jumps,
    },
  ];
}

function componentScenarios(): ComponentScenarioSpec[] {
  return [
    {
      html: RICH_TEXT_HTML,
      maxLines: 2,
      name: "component-rich-continuous",
      widths: componentWidthPatterns.continuous,
    },
    {
      html: RICH_TEXT_HTML,
      maxLines: 2,
      name: "component-rich-jumps",
      widths: componentWidthPatterns.jumps,
    },
  ];
}

afterEach(() => {
  trackedRoots.length = 0;
  trackedMetrics = null;
  document.body.innerHTML = "";
});

beforeAll(() => {
  if (
    !originalGetBoundingClientRect ||
    !originalGetClientRects ||
    !originalReplaceChildren ||
    !originalCloneNode
  ) {
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

  Element.prototype.replaceChildren = function patchedReplaceChildren(
    this: Element,
    ...nodes: (Node | string)[]
  ): void {
    if (trackedMetrics && isTrackedElement(this)) {
      trackedMetrics.replaceChildrenCalls += 1;
    }

    originalReplaceChildren.apply(this, nodes);
  };

  Node.prototype.cloneNode = function patchedCloneNode(this: Node, deep?: boolean): Node {
    if (trackedMetrics && this instanceof Element && isTrackedElement(this)) {
      trackedMetrics.cloneNodeCalls += 1;

      if (this instanceof HTMLImageElement) {
        trackedMetrics.imageCloneCalls += 1;
      }
    }

    return originalCloneNode.call(this, deep);
  };
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

  if (originalReplaceChildrenDescriptor) {
    Object.defineProperty(Element.prototype, "replaceChildren", originalReplaceChildrenDescriptor);
  }

  if (originalCloneNodeDescriptor) {
    Object.defineProperty(Node.prototype, "cloneNode", originalCloneNodeDescriptor);
  }
});

describe("RichLineClamp benchmark", () => {
  it("reports direct and component rich clamp workloads", async () => {
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

    console.error(`RICH_BENCHMARK ${JSON.stringify({ scenarios: results })}`);

    expect(results).toHaveLength(directScenarios().length + componentScenarios().length);
    for (const result of results) {
      expect(result.summary.runs).toHaveLength(benchmarkMeasuredRuns);
    }
  });
});
