import { clearCache } from "@chenglou/pretext";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { clampTextToLayout, prepareText, setElementText } from "../src/text.ts";
import { clampPreparedLine, prepareLineClamp } from "../src/pretext/clamp.ts";

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

const lineLimit = 3;
const lineHeight = 22;
const repetitions = 5;

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
        const pretextRuns: Run[] = [];

        for (let repetition = 0; repetition < repetitions; repetition += 1) {
          if (repetition % 2 === 0) {
            browserRuns.push(runBrowser(scenario, pattern.widths, browserPrepared));
            pretextRuns.push(runPretext(scenario, pattern.widths, pretextPrepared));
          } else {
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
});

afterEach(() => {
  document.body.innerHTML = "";
});
