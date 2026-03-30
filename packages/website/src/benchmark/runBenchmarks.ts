import type { ClampLocation } from "../../../vue-clamp/src/types.ts";
import { runLegacyDomClamp } from "../../../vue-clamp/benchmark/dom/legacy.ts";
import { runOptimizedLegacyDomClamp } from "../../../vue-clamp/benchmark/dom/optimized.ts";
import { runPretextDomClamp } from "../../../vue-clamp/benchmark/pretext-dom.ts";
import type {
  BenchmarkClampInput,
  BenchmarkDomFixture,
} from "../../../vue-clamp/benchmark/types.ts";

export type BenchmarkEngineName = "legacy-dom" | "optimized-dom" | "pretext";
type BenchmarkOperation = "initial" | "noop" | "resize" | "text-update" | "slot-update";

export const BENCHMARK_BASELINE_ENGINE: BenchmarkEngineName = "legacy-dom";
export const BENCHMARK_MIN_MACRO_RUNS = 9;

const ENGINES = ["legacy-dom", "optimized-dom", "pretext"] as const;
const RUNNERS: Record<BenchmarkEngineName, (input: BenchmarkClampInput) => void> = {
  "legacy-dom": runLegacyDomClamp,
  "optimized-dom": runOptimizedLegacyDomClamp,
  pretext: runPretextDomClamp,
};

export interface BenchmarkScenario {
  id: string;
  label: string;
  operation: BenchmarkOperation;
  batchSize: number;
  macroRuns: number;
  warmupIterations: number;
  iterations: number;
  text: string;
  nextText?: string;
  width: number;
  nextWidth?: number;
  maxLines?: number;
  maxHeight?: number | string;
  location: ClampLocation;
  ellipsis: string;
  beforeText?: string;
  nextBeforeText?: string;
  afterText?: string;
  nextAfterText?: string;
  uniquePerItem?: boolean;
}

interface BenchmarkEngineReport {
  medianIterationMs: number;
}

interface BenchmarkScenarioReport {
  scenario: BenchmarkScenario;
  results: Record<BenchmarkEngineName, BenchmarkEngineReport>;
  winner: BenchmarkEngineName;
}

export interface BenchmarkReport {
  methodology: {
    baselineEngine: BenchmarkEngineName;
    minimumMacroRuns: number;
  };
  scenarios: BenchmarkScenarioReport[];
  summary: {
    wins: Record<BenchmarkEngineName, number>;
  };
}

const englishText =
  "Vue is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable across layouts that change often.";
const chineseText =
  "Vue 是一套用于构建用户界面的渐进式框架。与其它大型框架不同的是，Vue 被设计为可以自底向上逐层应用，并且能够在频繁变化的布局中保持良好的可用性。";
const emojiText =
  "Launch status 😀 remains stable while teams triage fixes 🚀, verify release notes 📝, and keep customer-facing updates calm and readable.";
const bidiText =
  "Vue يساعد الفرق العربية على بناء واجهات مرنة while product teams keep English labels, metrics 12345, and mixed-direction content readable.";
const longTokenText =
  "https://example.com/releases/supercalifragilisticexpialidocious-build-with-an-extremely-long-unbroken-token-that-forces-overflow-wrap";

const benchmarkScenarios: BenchmarkScenario[] = [
  {
    id: "single-fit",
    label: "Single fit",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 96,
    text: "Short content that fits in one line.",
    width: 420,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "single-end-english",
    label: "Single end clamp",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 84,
    text: englishText,
    width: 280,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "single-end-cjk",
    label: "Single end clamp CJK",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 84,
    text: chineseText,
    width: 260,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "single-end-emoji",
    label: "Single end clamp emoji",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 84,
    text: emojiText,
    width: 260,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "single-end-bidi",
    label: "Single end clamp bidi",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 84,
    text: bidiText,
    width: 280,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "single-start",
    label: "Single start clamp",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 72,
    text: englishText,
    width: 280,
    maxLines: 3,
    location: "start",
    ellipsis: "…",
  },
  {
    id: "single-middle",
    label: "Single middle clamp",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 72,
    text: englishText,
    width: 260,
    maxLines: 2,
    location: "middle",
    ellipsis: "…",
  },
  {
    id: "single-with-slots",
    label: "Single with slots",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 72,
    text: englishText,
    width: 280,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
    beforeText: "[Featured]",
    afterText: "[Read more]",
  },
  {
    id: "single-max-height",
    label: "Single max-height",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 72,
    text: englishText,
    width: 300,
    maxHeight: "72px",
    location: "end",
    ellipsis: "…",
  },
  {
    id: "single-long-token",
    label: "Single long token",
    operation: "initial",
    batchSize: 1,
    macroRuns: 3,
    warmupIterations: 16,
    iterations: 72,
    text: longTokenText,
    width: 260,
    maxLines: 2,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "batch-noop-shared",
    label: "Batch noop shared text",
    operation: "noop",
    batchSize: 24,
    macroRuns: 3,
    warmupIterations: 6,
    iterations: 18,
    text: englishText,
    width: 300,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "batch-noop-unique",
    label: "Batch noop unique text",
    operation: "noop",
    batchSize: 24,
    macroRuns: 3,
    warmupIterations: 6,
    iterations: 18,
    text: englishText,
    width: 300,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
    uniquePerItem: true,
  },
  {
    id: "batch-resize-shared",
    label: "Batch resize shared text",
    operation: "resize",
    batchSize: 24,
    macroRuns: 3,
    warmupIterations: 6,
    iterations: 18,
    text: englishText,
    width: 420,
    nextWidth: 240,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "batch-resize-unique",
    label: "Batch resize unique text",
    operation: "resize",
    batchSize: 24,
    macroRuns: 3,
    warmupIterations: 6,
    iterations: 18,
    text: englishText,
    width: 420,
    nextWidth: 240,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
    uniquePerItem: true,
  },
  {
    id: "batch-text-update",
    label: "Batch text update",
    operation: "text-update",
    batchSize: 24,
    macroRuns: 3,
    warmupIterations: 6,
    iterations: 18,
    text: englishText,
    nextText: chineseText,
    width: 300,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
  },
  {
    id: "batch-slot-update",
    label: "Batch slot update",
    operation: "slot-update",
    batchSize: 24,
    macroRuns: 3,
    warmupIterations: 6,
    iterations: 18,
    text: englishText,
    width: 280,
    maxLines: 3,
    location: "end",
    ellipsis: "…",
    afterText: "[More]",
    nextAfterText: "[Read the full release note]",
  },
];

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function normalizeCssLength(value: number | string | undefined): string {
  if (value === undefined) {
    return "";
  }

  return typeof value === "number" ? `${value}px` : value;
}

function buildVariantText(text: string, itemIndex: number, uniquePerItem: boolean): string {
  if (!uniquePerItem) {
    return text;
  }

  return `${text} [${itemIndex.toString(36)}]`;
}

function buildFixture(container: HTMLElement, scenario: BenchmarkScenario): BenchmarkDomFixture {
  const rootElement = document.createElement("div");
  rootElement.className = "benchmark-fixture";
  rootElement.style.width = `${scenario.width}px`;
  rootElement.style.font = "16px Georgia, serif";
  rootElement.style.lineHeight = "24px";
  rootElement.style.overflow = "hidden";
  rootElement.style.whiteSpace = "normal";
  rootElement.style.overflowWrap = "break-word";
  rootElement.style.maxHeight = normalizeCssLength(scenario.maxHeight);

  const contentElement = document.createElement("span");
  const textElement = document.createElement("span");
  contentElement.append(textElement);

  let beforeElement: HTMLElement | null = null;
  if (scenario.beforeText || scenario.nextBeforeText) {
    beforeElement = document.createElement("span");
    beforeElement.className = "benchmark-slot";
    beforeElement.textContent = scenario.beforeText ?? "";
    contentElement.prepend(beforeElement);
  }

  let afterElement: HTMLElement | null = null;
  if (scenario.afterText || scenario.nextAfterText) {
    afterElement = document.createElement("span");
    afterElement.className = "benchmark-slot";
    afterElement.textContent = scenario.afterText ?? "";
    contentElement.append(afterElement);
  }

  rootElement.append(contentElement);
  container.append(rootElement);

  return {
    rootElement,
    contentElement,
    textElement,
    beforeElement,
    afterElement,
  };
}

function removeFixtures(fixtures: BenchmarkDomFixture[]): void {
  for (const fixture of fixtures) {
    fixture.rootElement.remove();
  }
}

function applyScenarioState(
  scenario: BenchmarkScenario,
  fixture: BenchmarkDomFixture,
  iteration: number,
  itemIndex: number,
): string {
  let width = scenario.width;
  if (scenario.operation === "resize" && scenario.nextWidth !== undefined) {
    width = iteration % 2 === 0 ? scenario.width : scenario.nextWidth;
  }

  let text = scenario.text;
  if (scenario.operation === "text-update" && scenario.nextText) {
    text = iteration % 2 === 0 ? scenario.text : scenario.nextText;
  }

  if (fixture.beforeElement) {
    const beforeText =
      scenario.operation === "slot-update" && scenario.nextBeforeText
        ? iteration % 2 === 0
          ? (scenario.beforeText ?? "")
          : scenario.nextBeforeText
        : (scenario.beforeText ?? "");
    fixture.beforeElement.textContent = beforeText;
  }

  if (fixture.afterElement) {
    const afterText =
      scenario.operation === "slot-update" && scenario.nextAfterText
        ? iteration % 2 === 0
          ? (scenario.afterText ?? "")
          : scenario.nextAfterText
        : (scenario.afterText ?? "");
    fixture.afterElement.textContent = afterText;
  }

  fixture.rootElement.style.width = `${width}px`;
  fixture.rootElement.style.maxHeight = normalizeCssLength(scenario.maxHeight);

  return buildVariantText(text, itemIndex, scenario.uniquePerItem ?? false);
}

function createClampInput(
  scenario: BenchmarkScenario,
  fixture: BenchmarkDomFixture,
  text: string,
): BenchmarkClampInput {
  const input: BenchmarkClampInput = {
    fixture,
    text,
    ellipsis: scenario.ellipsis,
    location: scenario.location,
  };

  if (scenario.maxLines !== undefined) {
    input.maxLines = scenario.maxLines;
  }

  if (scenario.maxHeight !== undefined) {
    input.maxHeight = scenario.maxHeight;
  }

  return input;
}

function geometricMean(values: readonly number[]): number {
  const positiveValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (positiveValues.length === 0) {
    return 0;
  }

  const total = positiveValues.reduce((sum, value) => sum + Math.log(value), 0);
  return Math.exp(total / positiveValues.length);
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  return sorted[middle]!;
}

function benchmarkEngine(
  container: HTMLElement,
  scenario: BenchmarkScenario,
  engine: BenchmarkEngineName,
): BenchmarkEngineReport {
  const runner = RUNNERS[engine];
  const macroRunIterationMs: number[] = [];
  const macroRuns = Math.max(scenario.macroRuns, BENCHMARK_MIN_MACRO_RUNS);

  for (let macroRun = 0; macroRun < macroRuns; macroRun += 1) {
    const fixtures = Array.from({ length: scenario.batchSize }, () =>
      buildFixture(container, scenario),
    );

    try {
      for (let iteration = 0; iteration < scenario.warmupIterations; iteration += 1) {
        for (const [itemIndex, fixture] of fixtures.entries()) {
          const text = applyScenarioState(scenario, fixture, iteration, itemIndex);
          runner(createClampInput(scenario, fixture, text));
        }
      }

      const start = performance.now();

      for (let iteration = 0; iteration < scenario.iterations; iteration += 1) {
        for (const [itemIndex, fixture] of fixtures.entries()) {
          const text = applyScenarioState(scenario, fixture, iteration, itemIndex);
          runner(createClampInput(scenario, fixture, text));
        }
      }

      const totalMs = performance.now() - start;
      macroRunIterationMs.push(totalMs / scenario.iterations);
    } finally {
      removeFixtures(fixtures);
    }
  }

  return {
    medianIterationMs: median(macroRunIterationMs),
  };
}

export async function runAllBenchmarks(container: HTMLElement): Promise<BenchmarkReport> {
  await document.fonts?.ready;
  await nextFrame();

  const scenarios: BenchmarkScenarioReport[] = [];
  const wins: Record<BenchmarkEngineName, number> = {
    "legacy-dom": 0,
    "optimized-dom": 0,
    pretext: 0,
  };
  const engineOrders: BenchmarkEngineName[][] = [
    ["legacy-dom", "optimized-dom", "pretext"],
    ["optimized-dom", "pretext", "legacy-dom"],
    ["pretext", "legacy-dom", "optimized-dom"],
  ];

  for (const [scenarioIndex, scenario] of benchmarkScenarios.entries()) {
    const order = engineOrders[scenarioIndex % engineOrders.length]!;
    const results = {} as Record<BenchmarkEngineName, BenchmarkEngineReport>;

    for (const engine of order) {
      await nextFrame();
      results[engine] = benchmarkEngine(container, scenario, engine);
    }

    const winner = ENGINES.reduce((fastest, current) =>
      results[current].medianIterationMs < results[fastest].medianIterationMs ? current : fastest,
    );
    wins[winner] += 1;

    scenarios.push({
      scenario,
      results,
      winner,
    });
  }

  return {
    methodology: {
      baselineEngine: BENCHMARK_BASELINE_ENGINE,
      minimumMacroRuns: BENCHMARK_MIN_MACRO_RUNS,
    },
    scenarios,
    summary: {
      wins,
    },
  };
}

export function summarizeGeometricMeanSpeedup(
  report: BenchmarkReport,
  faster: BenchmarkEngineName,
  slower: BenchmarkEngineName,
): number {
  return geometricMean(
    report.scenarios.map(
      (scenario) =>
        scenario.results[slower].medianIterationMs / scenario.results[faster].medianIterationMs,
    ),
  );
}
