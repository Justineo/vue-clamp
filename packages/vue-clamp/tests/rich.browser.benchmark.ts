import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { clampRichTextToLayout, prepareRichText } from "../src/rich.ts";
import { frame } from "./browser.ts";

import type { RichClampDecision } from "../src/rich.ts";

type BenchmarkRun = {
  boundingRectReads: number;
  clientRectReads: number;
  meanStepMs: number;
  replaceChildrenCalls: number;
  totalMs: number;
};

type BenchmarkSummary = {
  medianBoundingRectReads: number;
  medianClientRectReads: number;
  medianMeanStepMs: number;
  medianReplaceChildrenCalls: number;
  medianTotalMs: number;
  runs: BenchmarkRun[];
};

type ScenarioSpec = {
  htmls: string[];
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

type TrackingMetrics = Omit<BenchmarkRun, "meanStepMs" | "totalMs">;

const RICH_TEXT_HTML =
  '<strong>Vue</strong> ships <img alt="" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2212%22 viewBox=%220 0 24 12%22%3E%3Crect width=%2224%22 height=%2212%22 rx=%226%22 fill=%22%23005BD2%22/%3E%3C/svg%3E" style="width:24px;height:12px;vertical-align:baseline" /> <a href="/docs">layout-aware rich text clamping</a> for <em>inline content</em> and trailing markup.';
const ARTICLE_HTML =
  '<strong>Design systems</strong> need <a href="/guides"><em>predictable</em> truncation</a> when inline badges, <code>code</code>, and <span style="white-space:nowrap">non-breaking phrases</span> share the same paragraph.';
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
    medianMeanStepMs: median(runs.map((run) => run.meanStepMs)),
    medianReplaceChildrenCalls: median(runs.map((run) => run.replaceChildrenCalls)),
    medianTotalMs: median(runs.map((run) => run.totalMs)),
    runs,
  };
}

function isTrackedElement(element: Element): boolean {
  return trackedRoots.some((root) => element === root || root.contains(element));
}

function beginTracking(roots: readonly HTMLElement[]): void {
  trackedRoots.length = 0;
  trackedRoots.push(...roots);
  trackedMetrics = {
    boundingRectReads: 0,
    clientRectReads: 0,
    replaceChildrenCalls: 0,
  };
}

function endTracking(): TrackingMetrics {
  const metrics = trackedMetrics ?? {
    boundingRectReads: 0,
    clientRectReads: 0,
    replaceChildrenCalls: 0,
  };
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

  const rich = document.createElement("span");
  rich.innerHTML = html;

  body.append(rich);
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
    rich,
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
): void {
  const result = clampRichTextToLayout(
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

async function runScenario(spec: ScenarioSpec): Promise<BenchmarkRun> {
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
      runClamp(prepared[index]!, hosts[index]!, spec.maxLines);
    }

    beginTracking(hosts.map((host) => host.root));

    let totalMs = 0;
    const measuredWidths = spec.widths.slice(1);

    for (const width of measuredWidths) {
      const startedAt = performance.now();

      for (const host of hosts) {
        host.setWidth(width);
      }

      for (let index = 0; index < hosts.length; index += 1) {
        runClamp(prepared[index]!, hosts[index]!, spec.maxLines);
      }

      totalMs += performance.now() - startedAt;
    }

    const tracked = endTracking();

    return {
      boundingRectReads: tracked.boundingRectReads,
      clientRectReads: tracked.clientRectReads,
      meanStepMs: totalMs / Math.max(1, measuredWidths.length),
      replaceChildrenCalls: tracked.replaceChildrenCalls,
      totalMs,
    };
  } finally {
    endTracking();

    for (const host of hosts) {
      host.destroy();
    }
  }
}

async function runBenchmark(spec: ScenarioSpec): Promise<BenchmarkSummary> {
  const runs: BenchmarkRun[] = [];

  for (let runIndex = 0; runIndex < benchmarkWarmupRuns + benchmarkMeasuredRuns; runIndex += 1) {
    const run = await runScenario(spec);

    if (runIndex >= benchmarkWarmupRuns) {
      runs.push(run);
    }
  }

  return summarize(runs);
}

const scenarios: ScenarioSpec[] = [
  {
    htmls: [ARTICLE_HTML],
    maxLines: 5,
    name: "fit-width-sweep",
    widths: [760, 720, 680, 640, 600, 640, 680, 720, 760],
  },
  {
    htmls: [RICH_TEXT_HTML],
    maxLines: 2,
    name: "truncate-width-sweep",
    widths: [320, 280, 240, 200, 160, 200, 240, 280, 320],
  },
  {
    htmls: makeTableHtmls(40),
    maxLines: 2,
    name: "dense-grid-width-sweep",
    widths: [260, 220, 180, 140, 180, 220, 260],
  },
];

afterEach(() => {
  trackedRoots.length = 0;
  trackedMetrics = null;
  document.body.innerHTML = "";
});

beforeAll(() => {
  if (!originalGetBoundingClientRect || !originalGetClientRects || !originalReplaceChildren) {
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
});

describe("RichLineClamp benchmark", () => {
  it("reports current rich clamp workload", async () => {
    const results: ScenarioResult[] = [];

    for (const scenario of scenarios) {
      results.push({
        scenario: scenario.name,
        summary: await runBenchmark(scenario),
      });
    }

    console.error(`RICH_BENCHMARK ${JSON.stringify({ scenarios: results })}`);

    expect(results).toHaveLength(scenarios.length);
    for (const result of results) {
      expect(result.summary.runs).toHaveLength(benchmarkMeasuredRuns);
    }
  });
});
