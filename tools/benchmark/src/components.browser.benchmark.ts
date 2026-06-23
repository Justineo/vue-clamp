import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, ref, version as vueVersion } from "vue";
import { benchmarkTargets } from "vue-clamp-benchmark-targets";
import {
  beginTracking,
  createActivityTracker,
  createPerformanceTracker,
  endTracking,
  flushVueUpdates,
  installBenchmarkSpies,
  resetBenchmarkDom,
  restoreBenchmarkSpies,
  summarizeRuns,
  type BenchmarkRun,
  type BenchmarkSummary,
  type StepDiagnostics,
} from "./helpers.ts";

import type { App, Component, Ref, VNodeChild } from "vue";

type ComponentName = "InlineClamp" | "LineClamp" | "RichLineClamp" | "WrapClamp";

type VueClampModule = Partial<Record<ComponentName, Component>>;

type BenchmarkTarget = {
  entry: string;
  module: VueClampModule;
  specifier: string;
  version: string;
};

type Counter = {
  increment: () => void;
  reset: () => void;
  value: () => number;
};

type MountedScenario = {
  app: App;
  collectExtraMetrics?: () => Record<string, number>;
  container: HTMLElement;
  resetExtraMetrics?: () => void;
  root: HTMLElement;
  width: Ref<number>;
};

type PublicScenario = {
  beforeStep?: (mounted: MountedScenario, stepIndex: number) => Promise<void> | void;
  component: ComponentName;
  group: "inline" | "line" | "rich" | "wrap";
  minVersion?: string;
  mount: (component: Component, initialWidth: number) => Promise<MountedScenario>;
  name: string;
  unsupportedReason?: string;
  widths: readonly number[];
  widthBursts?: readonly (readonly number[])[];
};

type WidthProfile = {
  largeDeltaThreshold: number;
  largeDeltaTransitions: number;
  maxDelta: number;
  repeatedTransitions: number;
  repeatedWidthAssignments: number;
  stepCount: number;
  transitionCount: number;
  uniqueWidthCount: number;
  widthAssignmentCount: number;
};

type ScenarioResult =
  | {
      component: ComponentName;
      group: PublicScenario["group"];
      scenario: string;
      status: "ok";
      summary: BenchmarkSummary;
      widthProfile: WidthProfile;
    }
  | {
      component: ComponentName;
      group: PublicScenario["group"];
      reason: string;
      scenario: string;
      status: "unsupported";
      widthProfile: WidthProfile;
    };

type CompactCounterSummary = {
  addedNodes: number;
  attributeMutationRecords: number;
  activeMs: number;
  boundingRectReads: number;
  characterDataMutationRecords: number;
  childListMutationRecords: number;
  clientHeightReads: number;
  clientRectEntries: number;
  clientRectReads: number;
  clientTopReads: number;
  clientWidthReads: number;
  hiddenAddedNodes: number;
  hiddenChildListMutationRecords: number;
  hiddenMutationRecords: number;
  hiddenRemovedNodes: number;
  mutationRecords: number;
  offsetHeightReads: number;
  offsetWidthReads: number;
  removedNodes: number;
  scrollWidthReads: number;
  styleReads: number;
};

type CompactScenarioResult = {
  component: ComponentName;
  group: PublicScenario["group"];
  reason?: string;
  scenario: string;
  status: ScenarioResult["status"];
  summary?: CompactCounterSummary & {
    extra?: Record<string, number>;
    rmeActiveMs: number;
    runs: number;
  };
  widthProfile: WidthProfile;
};

type BenchmarkMode = "report" | "smoke" | "strict";

type BenchmarkSamplingConfig = {
  maxScenarioMs: number;
  maxRuns: number;
  minScenarioMs: number;
  minRuns: number;
  mode: BenchmarkMode;
  warmupRuns: number;
};

const benchmarkSamplingConfig = samplingConfig();
const text =
  "Release dashboards often need compact summaries that keep important operational context visible while the container width changes.";
const wordBoundaryText =
  "International operations teams summarize customer-facing incidents, regional mitigations, and follow-up ownership without breaking words awkwardly.";
const cjkWordBoundaryText =
  "国际响应团队需要在多区域故障期间保持客户沟通、缓解措施和后续责任清晰可见，同时避免在关键短语中间截断。";
const longTokenWordBoundaryText = Array.from(
  { length: 36 },
  (_, index) => `observabilityPlatform${index + 1}`,
).join(" ");
const fallbackWordBoundaryText = "supercalifragilisticexpialidocious".repeat(8);
const sameWidthFontRecoveryText =
  "Release dashboards keep ownership visible after regional incidents across regions.";
const inlineText =
  "/workspace/vue-clamp/packages/components/long-generated-file-name.browser.benchmark.ts";
const inlineSentence =
  "Customer incident summaries should keep complete words visible while the available inline space changes.";
const richHtml =
  '<strong>Incident #4721</strong>: API latency moved after <code>release/2.4.0</code>. Owners are <span style="display:inline-block">Platform</span> and <a href="/status">Support</a>.';
const richTrailingSpaceHtml =
  "<span>Incident response </span><span>status updates </span><span>should preserve </span><span>spacing inside inline wrappers </span><span>while width changes.</span>";
const articleHtml =
  '<strong>Design systems</strong> need <a href="/guides"><em>predictable</em> truncation</a> when inline badges, <code>code</code>, and <span style="white-space:nowrap">non-breaking phrases</span> share the same paragraph.';
const richWordHtml =
  "<strong>International response</strong> keeps regional mitigations, customer communications, and ownership notes readable without cutting important words in half.";
const richCjkWordHtml =
  '<strong>国际响应</strong>团队需要在<a href="/status">多区域故障</a>期间保留客户沟通、缓解措施和后续责任，避免关键短语被截断。';
const richSameWidthFontRecoveryHtml =
  "<strong>Release dashboards</strong> keep ownership visible after <em>regional incidents across regions</em>.";
const richLongTokenHtml = `<strong>Telemetry</strong> ${Array.from(
  { length: 28 },
  (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
).join(" ")}`;
const richClassAtomicCss =
  ".rich-atomic-token{display:inline-block;width:36px;height:12px;vertical-align:baseline}";
const richClassAtomicHtml =
  '<span class="rich-atomic-token">A</span> <span class="rich-atomic-token">B</span> trailing rich copy for class styled atomic inline boxes.';
const richDynamicAtomicCss =
  ".rich-dynamic-token{display:var(--bench-rich-token-display,inline);width:42px;height:14px;vertical-align:baseline}";
const richDynamicAtomicHtml =
  '<span class="rich-dynamic-token">Alpha</span> <span class="rich-dynamic-token">Beta</span> dynamic rich copy for wrappers that switch between text flow and atomic boxes.';
const denseRichHtmls = Array.from(
  { length: 40 },
  (_, index) =>
    `<strong>Row ${index + 1}</strong> includes <a href="/rows/${index + 1}">inline <em>metadata</em></a>, <span style="display:inline-block">badge ${index + 1}</span>, and trailing summary copy that may need truncation.`,
);
const singleLineWidths = [
  140, 160, 180, 200, 220, 240, 260, 280, 300, 280, 260, 240, 220, 200, 180, 160, 140,
];
const tableWidths = [180, 220, 260, 300, 340, 300, 260, 220, 180];
const tableWidthBursts = [
  [220, 260, 300, 340],
  [300, 260, 220, 180],
  [220, 260, 300, 340],
  [300, 260, 220, 180],
] as const;
const wrapJumpGrowWidths = [340, 180, 340, 180, 340, 180, 340];
const wrapShrinkWidths = [340, 220, 180, 150, 120];
const wrapHiddenGrowWidths = [120, 520, 120, 520, 120, 520];
const wrapLargeNGrowWidths = [120, 520, 120, 520];
const wrapGrowWidths = [120, 520, 120, 520];
const wrapWideItemGrowWidths = [160, 520, 160, 520];
const wrapWideContainerGrowWidths = [120, 760, 120, 760];
const wrapTinyItemWideGrowWidths = [120, 960, 120, 960];
const wrapMixedItemGrowWidths = [120, 680, 120, 680];
const lineFeatureWidths = repeatedWidths([520, 260, 500, 280, 460, 240, 520], 3);
const lineCtaNovelJitterWidths = novelJitterWidths(35, 330, 180, 460, 79, 0x244);
const lineWordNovelJitterWidths = novelJitterWidths(35, 390, 220, 560, 79, 0x234);
const lineCjkJitterWidths = [
  520, 486, 509, 471, 447, 466, 432, 398, 421, 384, 356, 379, 342, 315, 337, 301, 276, 298, 263,
  241, 267, 289, 323, 351, 386, 414, 449, 478, 505,
];
const lineCjkNovelJitterWidths = novelJitterWidths(35, 420, 260, 560, 79, 0x235);
const lineHeightAffixWidths = [
  ...repeatedWidths([460, 180, 440, 200, 420, 160, 460], 4),
  ...widthSweep(460, 180, -20),
  ...widthSweep(200, 460, 20),
  ...repeatedWidths([640, 120, 600, 140, 560, 160, 640], 3),
];
const lineLongTokenWidths = repeatedWidths([640, 560, 620, 540, 600, 520, 640], 5);
const lineLongTokenNovelJitterWidths = novelJitterWidths(35, 610, 500, 700, 83, 0x551);
const lineStepWidths = repeatedWidths(
  [...widthSweep(640, 500, -20), ...widthSweep(520, 640, 20)],
  2,
);
const inlineFeatureWidths = repeatedWidths([340, 110, 320, 140, 280, 100, 340], 3);
const richFeatureWidths = repeatedWidths([400, 160, 380, 180, 340, 140, 400], 3);
const richMetadataNovelJitterWidths = novelJitterWidths(35, 260, 140, 360, 73, 0x245);
const richWordNovelJitterWidths = novelJitterWidths(35, 300, 160, 460, 73, 0x531);
const richCjkJitterWidths = [
  400, 367, 389, 354, 329, 351, 317, 286, 309, 274, 249, 271, 238, 214, 236, 203, 181, 207, 229,
  258, 291, 323, 346, 376, 392,
];
const richCjkNovelJitterWidths = novelJitterWidths(35, 320, 180, 460, 73, 0x532);
const richLongTokenWidths = repeatedWidths([640, 560, 620, 540, 600, 520, 640], 5);
const richLongTokenNovelJitterWidths = novelJitterWidths(35, 590, 480, 680, 79, 0x552);
const richFullFitTransitionWidths = [180, 220, 960, 180, 960, 220, 960];
const sameWidthFontRecoveryWidths = [420, 420, 420, 420, 420, 420, 420];
const largeWidthDeltaThreshold = 32;
const lineBatchSize = 16;
const inlineBatchSize = 16;
const richBatchSize = 16;

const targets = benchmarkTargets as BenchmarkTarget[];

async function dispatchFontLoadRecompute(): Promise<void> {
  document.fonts?.dispatchEvent(new Event("loadingdone"));
  await flushVueUpdates();
}

async function dispatchFontSizeRecompute(
  mounted: MountedScenario,
  stepIndex: number,
): Promise<void> {
  mounted.container.style.setProperty("--bench-font-size", stepIndex % 2 === 0 ? "18px" : "16px");
  document.fonts?.dispatchEvent(new Event("loadingdone"));
  await flushVueUpdates();
}

async function dispatchSameWidthFontRecovery(
  mounted: MountedScenario,
  stepIndex: number,
): Promise<void> {
  mounted.container.style.setProperty("--bench-font-size", stepIndex % 2 === 0 ? "12px" : "24px");
  document.fonts?.dispatchEvent(new Event("loadingdone"));
  await flushVueUpdates();
}

async function toggleRichAtomicDisplay(mounted: MountedScenario, stepIndex: number): Promise<void> {
  mounted.container.style.setProperty(
    "--bench-rich-token-display",
    stepIndex % 2 === 0 ? "inline-block" : "inline",
  );
  await flushVueUpdates();
}

function integerSamplingValue(name: keyof typeof __VUE_CLAMP_BENCH_SAMPLING__): number | null {
  const value = __VUE_CLAMP_BENCH_SAMPLING__[name];
  if (typeof value !== "number") {
    return null;
  }

  const integerValue = Math.trunc(value);
  if (integerValue < 0) {
    throw new Error(`VUE_CLAMP_BENCH_${name.toUpperCase()} must be greater than or equal to 0.`);
  }

  return integerValue;
}

function samplingConfig(): BenchmarkSamplingConfig {
  const mode = (__VUE_CLAMP_BENCH_SAMPLING__.mode ?? "report") as BenchmarkMode;
  const defaults: Record<BenchmarkMode, Omit<BenchmarkSamplingConfig, "mode">> = {
    report: {
      maxScenarioMs: 15_000,
      maxRuns: 30,
      minRuns: 5,
      minScenarioMs: 2_000,
      warmupRuns: 1,
    },
    smoke: {
      maxScenarioMs: 1_000_000,
      maxRuns: 3,
      minRuns: 3,
      minScenarioMs: 0,
      warmupRuns: 1,
    },
    strict: {
      maxScenarioMs: 30_000,
      maxRuns: 50,
      minRuns: 5,
      minScenarioMs: 5_000,
      warmupRuns: 2,
    },
  };
  const preset = defaults[mode];

  if (!preset) {
    throw new Error('VUE_CLAMP_BENCH_MODE must be one of "smoke", "report", or "strict".');
  }

  const minRuns = integerSamplingValue("minRuns") ?? preset.minRuns;
  const maxRuns = integerSamplingValue("maxRuns") ?? preset.maxRuns;
  const warmupRuns = integerSamplingValue("warmupRuns") ?? preset.warmupRuns;
  const maxScenarioMs = __VUE_CLAMP_BENCH_SAMPLING__.maxScenarioMs ?? preset.maxScenarioMs;
  const minScenarioMs = __VUE_CLAMP_BENCH_SAMPLING__.minScenarioMs ?? preset.minScenarioMs;

  if (maxScenarioMs <= 0) {
    throw new Error("VUE_CLAMP_BENCH_MAX_SCENARIO_MS must be greater than 0.");
  }
  if (minScenarioMs < 0) {
    throw new Error("VUE_CLAMP_BENCH_MIN_SCENARIO_MS must be greater than or equal to 0.");
  }
  if (minRuns < 2) {
    throw new Error("VUE_CLAMP_BENCH_MIN_RUNS must be at least 2.");
  }
  if (maxRuns < minRuns) {
    throw new Error("VUE_CLAMP_BENCH_MAX_RUNS must be greater than or equal to min runs.");
  }

  return {
    maxScenarioMs,
    maxRuns,
    minScenarioMs,
    minRuns,
    mode,
    warmupRuns,
  };
}

function createCounter(): Counter {
  let count = 0;

  return {
    increment: () => {
      count += 1;
    },
    reset: () => {
      count = 0;
    },
    value: () => count,
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

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function unsupportedScenarioReason(
  scenario: PublicScenario,
  target: Pick<BenchmarkTarget, "version">,
): string | null {
  if (scenario.minVersion && compareVersions(target.version, scenario.minVersion) < 0) {
    return (
      scenario.unsupportedReason ??
      `${scenario.name} requires vue-clamp ${scenario.minVersion} or newer.`
    );
  }

  return null;
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

function reflectedWidth(value: number, min: number, max: number): number {
  let next = value;

  while (next < min || next > max) {
    next = next < min ? min + (min - next) : max - (next - max);
  }

  return next;
}

function nearestNovelWidth(
  candidate: number,
  min: number,
  max: number,
  direction: number,
  seen: ReadonlySet<number>,
): number {
  if (!seen.has(candidate)) {
    return candidate;
  }

  for (let offset = 1; offset <= max - min; offset += 1) {
    const first = candidate + direction * offset;
    if (first >= min && first <= max && !seen.has(first)) {
      return first;
    }

    const second = candidate - direction * offset;
    if (second >= min && second <= max && !seen.has(second)) {
      return second;
    }
  }

  throw new Error("novelJitterWidths could not find a fresh width.");
}

function novelJitterWidths(
  count: number,
  start: number,
  min: number,
  max: number,
  maxDelta: number,
  seed: number,
): number[] {
  const span = max - min + 1;
  if (count > span) {
    throw new Error("novelJitterWidths count must fit within the width range.");
  }

  const widths: number[] = [];
  const seen = new Set<number>();
  let width = reflectedWidth(start, min, max);
  let state = seed;

  function add(next: number): void {
    width = next;
    seen.add(next);
    widths.push(next);
  }

  add(width);

  while (widths.length < count) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const unit = state / 0x100000000;
    const delta = Math.round((unit * 2 - 1) * maxDelta) || 1;
    const direction = delta < 0 ? -1 : 1;
    const candidate = reflectedWidth(width + delta, min, max);
    const next = nearestNovelWidth(candidate, min, max, direction, seen);

    add(next);
  }

  return widths;
}

function blockStyle(width: number, fontSize?: string): string {
  const fontStyle = fontSize
    ? [`font-family:Georgia,serif`, `font-size:${fontSize}`]
    : ["font:16px Georgia,serif"];

  return [
    "display:block",
    `width:${width}px`,
    ...fontStyle,
    "line-height:20px",
    "overflow-wrap:break-word",
  ].join(";");
}

function inlineStyle(width: number): string {
  return [
    `width:${width}px`,
    "font:16px Georgia,serif",
    "line-height:20px",
    "overflow-wrap:break-word",
  ].join(";");
}

function fixedBadgeStyle(width: number): string {
  return [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    `width:${width}px`,
    "height:24px",
    "border:1px solid currentColor",
    "border-radius:999px",
    "margin-inline-end:6px",
    "margin-block-end:6px",
    "white-space:nowrap",
  ].join(";");
}

function tableHostStyle(width: number): string {
  return ["display:block", `width:${width}px`, "font:16px Georgia,serif", "line-height:20px"].join(
    ";",
  );
}

function batchHostStyle(): string {
  return "display:grid;gap:4px;align-items:start";
}

function textVariant(baseText: string, index: number): string {
  return `${baseText} #${index + 1}`;
}

function richHtmlVariant(html: string, index: number): string {
  return `${html} <span style="white-space:nowrap">Batch ${index + 1}</span>`;
}

function trackElement(container: HTMLElement): HTMLElement {
  return container;
}

type LineClampBatchOptions = {
  after?: boolean;
  before?: boolean;
  boundary?: "grapheme" | "word";
  ellipsis?: string;
  fontSize?: string;
  location?: "start" | "middle" | "end" | number;
  maxHeight?: string;
  maxLines?: number;
  text?: string;
};

type InlineClampBatchOptions = {
  boundary?: "grapheme" | "word";
  ellipsis?: string;
  location?: "start" | "middle" | "end" | number;
  split?: (text: string) => { body: string; end?: string; start?: string };
  text?: string;
};

type RichLineClampBatchOptions = {
  after?: boolean;
  before?: boolean;
  boundary?: "grapheme" | "word";
  css?: string;
  ellipsis?: string;
  fontSize?: string;
  html?: string;
  maxHeight?: string;
  maxLines?: number;
};

function splitPath(value: string): { body: string; end?: string; start?: string } {
  const slashIndex = value.lastIndexOf("/");
  const extensionIndex = value.lastIndexOf(".");
  const hasExtension = extensionIndex > slashIndex;
  const parts: { body: string; end?: string; start?: string } = {
    body: value.slice(slashIndex + 1, hasExtension ? extensionIndex : undefined),
  };

  if (hasExtension) {
    parts.end = value.slice(extensionIndex);
  }

  if (slashIndex >= 0) {
    parts.start = value.slice(0, slashIndex + 1);
  }

  return parts;
}

function lineClampBatch(options: LineClampBatchOptions = {}): PublicScenario["mount"] {
  return (component, initialWidth) => mountLineClampBatch(component, initialWidth, options);
}

function inlineClampBatch(options: InlineClampBatchOptions = {}): PublicScenario["mount"] {
  return (component, initialWidth) => mountInlineClampBatch(component, initialWidth, options);
}

function richLineClampBatch(options: RichLineClampBatchOptions = {}): PublicScenario["mount"] {
  return (component, initialWidth) => mountRichLineClampBatch(component, initialWidth, options);
}

async function mountLineClampBatch(
  component: Component,
  initialWidth: number,
  options: LineClampBatchOptions = {},
): Promise<MountedScenario> {
  const width = ref(initialWidth);
  const beforeSlotCalls = createCounter();
  const afterSlotCalls = createCounter();
  const container = document.createElement("div");
  document.body.append(container);
  const instances = Array.from({ length: lineBatchSize }, (_, index) => index);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          { style: batchHostStyle() },
          instances.map((index) => {
            const props: Record<string, unknown> = {
              key: index,
              maxLines: options.maxLines,
              style: blockStyle(width.value, options.fontSize),
              text: textVariant(options.text ?? text, index),
            };
            const slots: Record<string, () => VNodeChild> = {};

            if (options.maxLines === undefined && options.maxHeight === undefined) {
              props.maxLines = 3;
            }
            if (options.maxHeight !== undefined) {
              props.maxHeight = options.maxHeight;
            }
            if (options.location !== undefined) {
              props.location = options.location;
            }
            if (options.boundary !== undefined) {
              props.boundary = options.boundary;
            }
            if (options.ellipsis !== undefined) {
              props.ellipsis = options.ellipsis;
            }

            if (options.before) {
              slots.before = () => {
                beforeSlotCalls.increment();
                return h("strong", { style: "margin-right:4px" }, "SLO");
              };
            }

            if (options.after) {
              slots.after = () => {
                afterSlotCalls.increment();
                return h(
                  "button",
                  {
                    style: "font:inherit;margin-left:4px;padding:0;border:0;background:transparent",
                    type: "button",
                  },
                  "more",
                );
              };
            }

            return h(component, props, slots);
          }),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushVueUpdates();

  return {
    app,
    collectExtraMetrics: () => ({
      afterSlotCalls: afterSlotCalls.value(),
      beforeSlotCalls: beforeSlotCalls.value(),
      componentInstances: lineBatchSize,
    }),
    container,
    resetExtraMetrics: () => {
      afterSlotCalls.reset();
      beforeSlotCalls.reset();
    },
    root: trackElement(container),
    width,
  };
}

async function mountInlineClampBatch(
  component: Component,
  initialWidth: number,
  options: InlineClampBatchOptions = {},
): Promise<MountedScenario> {
  const width = ref(initialWidth);
  const container = document.createElement("div");
  document.body.append(container);
  const instances = Array.from({ length: inlineBatchSize }, (_, index) => index);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          { style: batchHostStyle() },
          instances.map((index) =>
            h(component, {
              boundary: options.boundary,
              ellipsis: options.ellipsis,
              key: index,
              location: options.location ?? "end",
              split: options.split,
              style: inlineStyle(width.value),
              text: textVariant(options.text ?? inlineText, index),
            }),
          ),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushVueUpdates();

  return {
    app,
    collectExtraMetrics: () => ({ componentInstances: inlineBatchSize }),
    container,
    root: trackElement(container),
    width,
  };
}

async function mountRichLineClampBatch(
  component: Component,
  initialWidth: number,
  options: RichLineClampBatchOptions = {},
): Promise<MountedScenario> {
  const width = ref(initialWidth);
  const beforeSlotCalls = createCounter();
  const afterSlotCalls = createCounter();
  const container = document.createElement("div");
  document.body.append(container);
  const instances = Array.from({ length: richBatchSize }, (_, index) => index);

  const Host = defineComponent({
    setup() {
      return () =>
        h("div", { style: batchHostStyle() }, [
          options.css ? h("style", options.css) : null,
          ...instances.map((index) => {
            const props: Record<string, unknown> = {
              html: richHtmlVariant(options.html ?? richHtml, index),
              key: index,
              style: blockStyle(width.value, options.fontSize),
            };
            const slots: Record<string, () => VNodeChild> = {};

            if (options.maxLines === undefined && options.maxHeight === undefined) {
              props.maxLines = 2;
            }
            if (options.maxLines !== undefined) {
              props.maxLines = options.maxLines;
            }
            if (options.maxHeight !== undefined) {
              props.maxHeight = options.maxHeight;
            }
            if (options.boundary !== undefined) {
              props.boundary = options.boundary;
            }
            if (options.ellipsis !== undefined) {
              props.ellipsis = options.ellipsis;
            }

            if (options.after) {
              slots.after = () => {
                afterSlotCalls.increment();
                return h("span", { style: "margin-left:4px" }, "details");
              };
            }

            if (options.before) {
              slots.before = () => {
                beforeSlotCalls.increment();
                return h("strong", { style: "margin-right:4px" }, "SLO");
              };
            }

            return h(component, props, slots);
          }),
        ]);
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushVueUpdates();

  return {
    app,
    collectExtraMetrics: () => ({
      afterSlotCalls: afterSlotCalls.value(),
      beforeSlotCalls: beforeSlotCalls.value(),
      componentInstances: richBatchSize,
    }),
    container,
    resetExtraMetrics: () => {
      afterSlotCalls.reset();
      beforeSlotCalls.reset();
    },
    root: trackElement(container),
    width,
  };
}

async function mountRichFitLineClamp(
  component: Component,
  initialWidth: number,
): Promise<MountedScenario> {
  return mountRichLineClampBatch(component, initialWidth, { html: articleHtml, maxLines: 5 });
}

async function mountDenseRichLineClamp(
  component: Component,
  initialWidth: number,
): Promise<MountedScenario> {
  const width = ref(initialWidth);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          { style: tableHostStyle(720) },
          denseRichHtmls.map((html, index) =>
            h(component, {
              html,
              key: index,
              maxLines: 2,
              style: blockStyle(width.value),
            }),
          ),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushVueUpdates();

  return {
    app,
    collectExtraMetrics: () => ({ componentInstances: denseRichHtmls.length }),
    container,
    root: trackElement(container),
    width,
  };
}

type WrapTableOptions = {
  after?: "dynamic" | "static";
  before?: "dynamic" | "static";
  heavyItem?: boolean;
  hostWidth?: number;
  itemCount?: number;
  itemWidth?: number;
  itemWidths?: readonly number[];
  maxHeight?: string;
  maxLines?: number | undefined;
  rowCount?: number;
};

async function mountWrapTableScenario(
  component: Component,
  initialWidth: number,
  options: WrapTableOptions = {},
): Promise<MountedScenario> {
  const width = ref(initialWidth);
  const beforeSlotCalls = createCounter();
  const afterSlotCalls = createCounter();
  const itemSlotCalls = createCounter();
  const container = document.createElement("div");
  document.body.append(container);
  const rows = Array.from({ length: options.rowCount ?? 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: options.itemCount ?? 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  function renderWork(seed: string): number {
    let hash = 0;
    for (let index = 0; index < 600; index += 1) {
      hash = (hash * 33 + seed.charCodeAt(index % seed.length)) % 100_000;
    }
    return hash;
  }

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          { style: tableHostStyle(options.hostWidth ?? 640) },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxHeight: options.maxHeight,
                        maxLines: options.maxLines ?? 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        ...(options.before
                          ? {
                              before: ({ hiddenItems }: { hiddenItems: readonly string[] }) => {
                                beforeSlotCalls.increment();
                                const beforeWidth =
                                  options.before === "dynamic" && hiddenItems.length >= 10
                                    ? 160
                                    : 72;
                                return h("span", { style: fixedBadgeStyle(beforeWidth) }, "Lead");
                              },
                            }
                          : {}),
                        ...(options.after
                          ? {
                              after: ({
                                clamped,
                                hiddenItems,
                              }: {
                                clamped: boolean;
                                hiddenItems: readonly string[];
                              }) => {
                                afterSlotCalls.increment();
                                if (!clamped) {
                                  return null;
                                }

                                return h(
                                  "span",
                                  {
                                    style: fixedBadgeStyle(
                                      options.after === "dynamic" && hiddenItems.length >= 10
                                        ? 68
                                        : options.after === "dynamic"
                                          ? 32
                                          : 52,
                                    ),
                                  },
                                  options.after === "dynamic" ? `+${hiddenItems.length}` : "More",
                                );
                              },
                            }
                          : {}),
                        item: ({ index, item }: { index: number; item: string }): VNodeChild => {
                          itemSlotCalls.increment();
                          const itemWidth =
                            options.itemWidths?.[index % options.itemWidths.length] ??
                            options.itemWidth ??
                            40;
                          return h(
                            "span",
                            {
                              "data-render-work": options.heavyItem ? renderWork(item) : undefined,
                              style: fixedBadgeStyle(itemWidth),
                            },
                            item,
                          );
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushVueUpdates();

  return {
    app,
    collectExtraMetrics: () => ({
      afterSlotCalls: afterSlotCalls.value(),
      beforeSlotCalls: beforeSlotCalls.value(),
      itemSlotCalls: itemSlotCalls.value(),
    }),
    container,
    resetExtraMetrics: () => {
      afterSlotCalls.reset();
      beforeSlotCalls.reset();
      itemSlotCalls.reset();
    },
    root: trackElement(container),
    width,
  };
}

async function mountWrapSingleLineScenario(
  component: Component,
  initialWidth: number,
): Promise<MountedScenario> {
  const width = ref(initialWidth);
  const beforeSlotCalls = createCounter();
  const afterSlotCalls = createCounter();
  const itemSlotCalls = createCounter();
  const container = document.createElement("div");
  document.body.append(container);
  const items = Array.from({ length: 24 }, (_, index) => `Item ${index + 1}`);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          component,
          {
            items,
            maxLines: 1,
            style: tableHostStyle(width.value),
          },
          {
            after: ({
              clamped,
              hiddenItems,
            }: {
              clamped: boolean;
              hiddenItems: readonly string[];
            }) => {
              afterSlotCalls.increment();
              const hiddenCount = hiddenItems.length;
              return clamped
                ? h(
                    "span",
                    { style: fixedBadgeStyle(hiddenCount >= 10 ? 68 : hiddenCount > 0 ? 32 : 0) },
                    `+${hiddenCount}`,
                  )
                : null;
            },
            before: ({
              clamped,
              hiddenItems,
            }: {
              clamped: boolean;
              hiddenItems: readonly string[];
            }) => {
              beforeSlotCalls.increment();
              const visibleCount = items.length - hiddenItems.length;
              return h(
                "span",
                {
                  style: fixedBadgeStyle(
                    clamped ? (visibleCount >= 10 ? 56 : 44) : visibleCount >= 20 ? 72 : 60,
                  ),
                },
                "Lead",
              );
            },
            item: ({ item }: { item: string }) => {
              itemSlotCalls.increment();
              return h("span", { style: fixedBadgeStyle(52) }, item);
            },
          },
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);
  await flushVueUpdates();

  return {
    app,
    collectExtraMetrics: () => ({
      afterSlotCalls: afterSlotCalls.value(),
      beforeSlotCalls: beforeSlotCalls.value(),
      itemSlotCalls: itemSlotCalls.value(),
    }),
    container,
    resetExtraMetrics: () => {
      afterSlotCalls.reset();
      beforeSlotCalls.reset();
      itemSlotCalls.reset();
    },
    root: trackElement(container),
    width,
  };
}

function scenarios(): PublicScenario[] {
  const inlineMeasuredReason =
    "InlineClamp 1.0 used a native text-overflow implementation, so it is excluded from measured InlineClamp comparisons.";

  // Matrix rows are based on user-facing shapes first. Some rows are naturally
  // native-eligible in newer implementations, but that is a diagnostic outcome
  // rather than the reason the row exists.
  return [
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ maxLines: 1 }),
      name: "line-title-single-batch-sweep",
      widths: singleLineWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ after: true, before: true, maxLines: 1 }),
      name: "line-title-single-affix-batch-sweep",
      widths: singleLineWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ maxLines: 3 }),
      name: "line-summary-batch-continuous",
      widths: [...widthSweep(500, 220, -8), ...widthSweep(228, 500, 8)],
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ before: true, maxLines: 3 }),
      name: "line-prefixed-summary-batch-jumps",
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ after: true, maxLines: 3 }),
      name: "line-cta-affix-batch-continuous",
      widths: [...widthSweep(460, 180, -4), ...widthSweep(184, 460, 4)],
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ after: true, maxLines: 3 }),
      name: "line-cta-affix-batch-jitter",
      widths: jitterWidths(141, 330, 180, 460, 19, 0x42),
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ after: true, maxLines: 3 }),
      name: "line-cta-affix-batch-novel-jitter",
      widths: lineCtaNovelJitterWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ after: true, maxLines: 3 }),
      name: "line-cta-affix-batch-jumps",
      widths: repeatedWidths([460, 180, 440, 200, 420, 160, 460], 4),
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ location: "middle", maxLines: 3 }),
      name: "line-middle-log-batch-jumps",
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ location: "middle", maxLines: 5 }),
      name: "line-middle-log-lines5-batch-steps",
      widths: lineStepWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: wordBoundaryText }),
      name: "line-word-copy-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: wordBoundaryText }),
      name: "line-word-copy-batch-jitter",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: jitterWidths(121, 390, 220, 520, 17, 0x134),
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: wordBoundaryText }),
      name: "line-word-copy-batch-novel-jitter",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineWordNovelJitterWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 1, text: wordBoundaryText }),
      name: "line-word-copy-lines1-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 5, text: wordBoundaryText }),
      name: "line-word-copy-lines5-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 5, text: wordBoundaryText }),
      name: "line-word-copy-lines5-batch-steps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineStepWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: cjkWordBoundaryText }),
      name: "line-word-cjk-batch-jitter",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineCjkJitterWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: cjkWordBoundaryText }),
      name: "line-word-cjk-batch-novel-jitter",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineCjkNovelJitterWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: fallbackWordBoundaryText }),
      name: "line-word-fallback-batch-continuous",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: [...widthSweep(520, 260, -8), ...widthSweep(268, 520, 8)],
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-batch-novel-jitter",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenNovelJitterWidths,
    },
    {
      beforeStep: dispatchFontLoadRecompute,
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-font-tick-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      beforeStep: dispatchFontSizeRecompute,
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        fontSize: "var(--bench-font-size,16px)",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-font-size-tick-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      beforeStep: dispatchSameWidthFontRecovery,
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        fontSize: "var(--bench-font-size,24px)",
        maxLines: 2,
        text: sameWidthFontRecoveryText,
      }),
      name: "line-word-font-size-recover-full-same-width",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: sameWidthFontRecoveryWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        fontSize: "18px",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-tight-font-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        after: true,
        before: true,
        boundary: "word",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-affix-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        location: "middle",
        maxLines: 3,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-middle-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        maxLines: 1,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-lines1-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        maxLines: 5,
        text: longTokenWordBoundaryText,
      }),
      name: "line-word-long-token-lines5-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineLongTokenWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ maxHeight: "48px" }),
      name: "line-height-card-batch-jumps",
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      minVersion: "1.3.0",
      mount: lineClampBatch({
        boundary: "word",
        maxHeight: "48px",
        text: wordBoundaryText,
      }),
      name: "line-word-height-card-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineFeatureWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ after: true, before: true, maxHeight: "64px" }),
      name: "line-height-affix-card-batch-jumps",
      widths: lineHeightAffixWidths,
    },
    {
      component: "LineClamp",
      group: "line",
      mount: lineClampBatch({ ellipsis: "...", maxLines: 1 }),
      name: "line-custom-marker-batch-jumps",
      widths: lineFeatureWidths,
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.1.0",
      mount: inlineClampBatch({ location: "end" }),
      name: "inline-path-end-batch-continuous",
      unsupportedReason: inlineMeasuredReason,
      widths: [...widthSweep(320, 90, -4), ...widthSweep(94, 320, 4)],
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.1.0",
      mount: inlineClampBatch({ location: "end" }),
      name: "inline-path-end-batch-jumps",
      unsupportedReason: inlineMeasuredReason,
      widths: inlineFeatureWidths,
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.2.0",
      mount: inlineClampBatch({ location: "middle" }),
      name: "inline-path-middle-batch-continuous",
      unsupportedReason: "InlineClamp location handling was added in vue-clamp 1.2.0.",
      widths: [...widthSweep(320, 90, -4), ...widthSweep(94, 320, 4)],
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.2.0",
      mount: inlineClampBatch({ location: "middle" }),
      name: "inline-path-middle-batch-jitter",
      unsupportedReason: "InlineClamp location handling was added in vue-clamp 1.2.0.",
      widths: jitterWidths(121, 220, 90, 320, 13, 0x91),
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.2.0",
      mount: inlineClampBatch({ location: "middle" }),
      name: "inline-path-middle-batch-jumps",
      unsupportedReason: "InlineClamp location handling was added in vue-clamp 1.2.0.",
      widths: inlineFeatureWidths,
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.2.0",
      mount: inlineClampBatch({ location: "start" }),
      name: "inline-path-start-batch-jumps",
      unsupportedReason: "InlineClamp location handling was added in vue-clamp 1.2.0.",
      widths: inlineFeatureWidths,
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.1.0",
      mount: inlineClampBatch({ split: splitPath }),
      name: "inline-split-file-path-batch-jumps",
      unsupportedReason: inlineMeasuredReason,
      widths: inlineFeatureWidths,
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.3.0",
      mount: inlineClampBatch({
        boundary: "word",
        location: "end",
        text: inlineSentence,
      }),
      name: "inline-word-copy-batch-jumps",
      unsupportedReason: 'InlineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: inlineFeatureWidths,
    },
    {
      component: "InlineClamp",
      group: "inline",
      minVersion: "1.1.0",
      mount: inlineClampBatch({ ellipsis: "..." }),
      name: "inline-custom-marker-batch-jumps",
      unsupportedReason: inlineMeasuredReason,
      widths: inlineFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: mountRichFitLineClamp,
      name: "rich-article-fit-batch",
      widths: [760, 720, 680, 640, 600, 640, 680, 720, 760],
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ after: true, before: true, maxLines: 2 }),
      name: "rich-metadata-affix-batch-continuous",
      widths: [...widthSweep(360, 140, -4), ...widthSweep(144, 360, 4)],
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ after: true, before: true, maxLines: 2 }),
      name: "rich-metadata-affix-batch-jitter",
      widths: jitterWidths(121, 260, 140, 360, 21, 0x65),
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ after: true, before: true, maxLines: 2 }),
      name: "rich-metadata-affix-batch-novel-jitter",
      widths: richMetadataNovelJitterWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ after: true, before: true, maxLines: 2 }),
      name: "rich-metadata-affix-batch-jumps",
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ maxLines: 2 }),
      name: "rich-inline-markup-batch-continuous",
      widths: [...widthSweep(360, 140, -4), ...widthSweep(144, 360, 4)],
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ html: richTrailingSpaceHtml, maxLines: 2 }),
      name: "rich-trailing-space-markup-batch-continuous",
      widths: [...widthSweep(360, 140, -4), ...widthSweep(144, 360, 4)],
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richWordHtml,
        maxLines: 2,
      }),
      name: "rich-word-copy-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richWordHtml,
        maxLines: 2,
      }),
      name: "rich-word-copy-batch-jitter",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: jitterWidths(121, 300, 160, 420, 19, 0x531),
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richWordHtml,
        maxLines: 2,
      }),
      name: "rich-word-copy-batch-novel-jitter",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richWordNovelJitterWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richWordHtml,
        maxLines: 1,
      }),
      name: "rich-word-copy-lines1-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richWordHtml,
        maxLines: 5,
      }),
      name: "rich-word-copy-lines5-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richCjkWordHtml,
        maxLines: 3,
      }),
      name: "rich-word-cjk-batch-jitter",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richCjkJitterWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richCjkWordHtml,
        maxLines: 3,
      }),
      name: "rich-word-cjk-batch-novel-jitter",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richCjkNovelJitterWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        after: true,
        boundary: "word",
        html: richWordHtml,
        maxLines: 1,
      }),
      name: "rich-word-copy-affix-lines1-grow-full",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richFullFitTransitionWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        css: richClassAtomicCss,
        html: richClassAtomicHtml,
        maxLines: 1,
      }),
      name: "rich-word-class-atomic-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: repeatedWidths([96, 44, 88, 48, 92, 44, 96], 5),
    },
    {
      beforeStep: toggleRichAtomicDisplay,
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        css: richDynamicAtomicCss,
        html: richDynamicAtomicHtml,
        maxLines: 1,
      }),
      name: "rich-word-dynamic-atomic-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: repeatedWidths([120, 56, 112, 60, 116, 56, 120], 5),
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richLongTokenHtml,
        maxLines: 2,
      }),
      name: "rich-word-long-token-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richLongTokenHtml,
        maxLines: 2,
      }),
      name: "rich-word-long-token-batch-novel-jitter",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenNovelJitterWidths,
    },
    {
      beforeStep: dispatchFontLoadRecompute,
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richLongTokenHtml,
        maxLines: 5,
      }),
      name: "rich-word-long-token-font-tick-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenWidths,
    },
    {
      beforeStep: dispatchFontSizeRecompute,
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        fontSize: "var(--bench-font-size,16px)",
        html: richLongTokenHtml,
        maxLines: 5,
      }),
      name: "rich-word-long-token-font-size-tick-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenWidths,
    },
    {
      beforeStep: dispatchSameWidthFontRecovery,
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        fontSize: "var(--bench-font-size,24px)",
        html: richSameWidthFontRecoveryHtml,
        maxLines: 2,
      }),
      name: "rich-word-font-size-recover-full-same-width",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: sameWidthFontRecoveryWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        fontSize: "18px",
        html: richLongTokenHtml,
        maxLines: 5,
      }),
      name: "rich-word-long-token-tight-font-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richLongTokenHtml,
        maxLines: 1,
      }),
      name: "rich-word-long-token-lines1-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        after: true,
        boundary: "word",
        html: richLongTokenHtml,
        maxLines: 5,
      }),
      name: "rich-word-long-token-affix-lines5-grow-full",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richFullFitTransitionWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richLongTokenHtml,
        maxLines: 5,
      }),
      name: "rich-word-long-token-lines5-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richLongTokenWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ maxHeight: "44px" }),
      name: "rich-height-card-batch-jumps",
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ maxHeight: "44px", maxLines: 2 }),
      name: "rich-lines-height-card-batch-jumps",
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      minVersion: "1.3.0",
      mount: richLineClampBatch({
        boundary: "word",
        html: richWordHtml,
        maxHeight: "44px",
        maxLines: 5,
      }),
      name: "rich-word-height-card-batch-jumps",
      unsupportedReason: 'RichLineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ after: true, before: true, maxHeight: "64px" }),
      name: "rich-height-affix-card-batch-jumps",
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ after: true, before: true, maxHeight: "64px", maxLines: 2 }),
      name: "rich-lines-height-affix-card-batch-jumps",
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: richLineClampBatch({ ellipsis: "...", maxLines: 2 }),
      name: "rich-custom-marker-batch-jumps",
      widths: richFeatureWidths,
    },
    {
      component: "RichLineClamp",
      group: "rich",
      mount: mountDenseRichLineClamp,
      name: "rich-dense-batch-jumps",
      widths: [260, 220, 180, 140, 180, 220, 260],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: mountWrapSingleLineScenario,
      name: "wrap-single-line-width-sweep",
      widths: singleLineWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          after: "dynamic",
          itemCount: 7,
          itemWidth: 68,
        }),
      name: "wrap-table-demo-width-sweep",
      widths: tableWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          after: "dynamic",
          itemCount: 7,
          itemWidth: 68,
        }),
      name: "wrap-table-demo-width-churn",
      widthBursts: tableWidthBursts,
      widths: tableWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) => mountWrapTableScenario(component, width, { itemCount: 7 }),
      name: "wrap-no-affix-jump-grow",
      widths: wrapJumpGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) => mountWrapTableScenario(component, width, { itemCount: 7 }),
      name: "wrap-no-affix-shrink",
      widths: wrapShrinkWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-no-affix-hidden-grow",
      widths: wrapHiddenGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 200,
          itemWidth: 40,
          rowCount: 40,
        }),
      name: "wrap-no-affix-large-n",
      widths: wrapLargeNGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 48,
          itemWidth: 28,
          rowCount: 60,
        }),
      name: "wrap-no-affix-narrow-item-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 24,
          itemWidth: 72,
          rowCount: 60,
        }),
      name: "wrap-no-affix-wide-item-grow",
      widths: wrapWideItemGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          hostWidth: 880,
          itemCount: 64,
          itemWidth: 40,
          rowCount: 60,
        }),
      name: "wrap-no-affix-wide-container-grow",
      widths: wrapWideContainerGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          hostWidth: 1040,
          itemCount: 120,
          itemWidth: 16,
          rowCount: 40,
        }),
      name: "wrap-no-affix-tiny-item-wide-grow",
      widths: wrapTinyItemWideGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          hostWidth: 760,
          itemCount: 64,
          itemWidths: [24, 64, 36, 96, 48, 120, 28, 72],
          rowCount: 60,
        }),
      name: "wrap-no-affix-mixed-item-grow",
      widths: wrapMixedItemGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          heavyItem: true,
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-no-affix-heavy-item-grow",
      widths: wrapHiddenGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          before: "static",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-before-affix-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          before: "static",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-before-affix-shrink",
      widths: [520, 360, 240, 160, 120],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          before: "dynamic",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-dynamic-before-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          before: "dynamic",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-dynamic-before-shrink",
      widths: [520, 360, 240, 160, 120],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          after: "static",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-static-after-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          after: "static",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-static-after-shrink",
      widths: [520, 360, 240, 160, 120],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          after: "dynamic",
          before: "static",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-static-before-dynamic-after-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          after: "dynamic",
          itemCount: 24,
          itemWidth: 40,
        }),
      name: "wrap-after-affix-shrink",
      widths: [520, 360, 240, 160, 120],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 24,
          itemWidth: 40,
          maxHeight: "60px",
          maxLines: undefined,
        }),
      name: "wrap-max-height-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 24,
          itemWidth: 40,
          maxHeight: "60px",
          maxLines: undefined,
        }),
      name: "wrap-max-height-shrink",
      widths: [520, 360, 240, 160, 120],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          before: "static",
          itemCount: 24,
          itemWidth: 40,
          maxHeight: "60px",
          maxLines: undefined,
        }),
      name: "wrap-before-max-height-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          before: "static",
          itemCount: 24,
          itemWidth: 40,
          maxHeight: "60px",
          maxLines: undefined,
        }),
      name: "wrap-before-max-height-shrink",
      widths: [520, 360, 240, 160, 120],
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 24,
          itemWidth: 40,
          maxHeight: "60px",
          maxLines: 3,
        }),
      name: "wrap-mixed-lines-height-grow",
      widths: wrapGrowWidths,
    },
    {
      component: "WrapClamp",
      group: "wrap",
      mount: (component, width) =>
        mountWrapTableScenario(component, width, {
          itemCount: 24,
          itemWidth: 40,
          maxHeight: "60px",
          maxLines: 3,
        }),
      name: "wrap-mixed-lines-height-shrink",
      widths: [520, 360, 240, 160, 120],
    },
  ];
}

function matchesScenarioFilter(scenario: PublicScenario, filter: ReadonlySet<string>): boolean {
  return filter.has(scenario.name) || filter.has(scenario.group) || filter.has(scenario.component);
}

function selectedScenarios(): PublicScenario[] {
  const allScenarios = scenarios();
  const filter = new Set(__VUE_CLAMP_BENCH_SCENARIOS__);
  if (filter.size === 0) {
    return allScenarios;
  }

  const selected = allScenarios.filter((scenario) => matchesScenarioFilter(scenario, filter));
  if (selected.length === 0) {
    throw new Error(
      `VUE_CLAMP_BENCH_SCENARIOS did not match any scenario name, group, or component: ${[
        ...filter,
      ].join(", ")}`,
    );
  }

  return selected;
}

function emptyStepDiagnostics(): StepDiagnostics {
  return {
    activeMs: 0,
    droppedFrames: 0,
    frameCount: 0,
    frameIntervalMedianMs: 0,
    frameIntervalP95Ms: 0,
    framesToActive: 0,
    framesToSettle: 0,
    idleBudgetMs: 0,
    idleCallbackCount: 0,
    longAnimationFrameCount: 0,
    longAnimationFrameMs: 0,
    longTaskCount: 0,
    longTaskMs: 0,
    quietMs: 0,
    settleWaitMs: 0,
    settledMs: 0,
    updateMs: 0,
  };
}

async function runScenarioOnce(
  scenario: PublicScenario,
  component: Component,
): Promise<BenchmarkRun> {
  const initialWidth = scenario.widths[0];
  if (initialWidth === undefined) {
    throw new Error(`Scenario ${scenario.name} must provide at least one width.`);
  }

  const mounted = await scenario.mount(component, initialWidth);
  const activityTracker = createActivityTracker(mounted.root);
  const performanceTracker = createPerformanceTracker();

  try {
    await activityTracker.waitForStable();
    mounted.resetExtraMetrics?.();
    beginTracking(mounted.root);

    const diagnostics = emptyStepDiagnostics();
    const measuredSteps = scenario.widthBursts ?? scenario.widths.slice(1);

    for (const [stepIndex, step] of measuredSteps.entries()) {
      const startedAt = performance.now();
      await scenario.beforeStep?.(mounted, stepIndex);

      if (typeof step === "number") {
        mounted.width.value = step;
        await flushVueUpdates();
      } else {
        for (const width of step) {
          mounted.width.value = width;
          await flushVueUpdates();
        }
      }

      const finalWidth = typeof step === "number" ? step : step.at(-1);
      if (finalWidth === undefined) {
        throw new Error(`Scenario ${scenario.name} width burst must not be empty.`);
      }

      await flushVueUpdates();
      const updatedAt = performance.now();
      activityTracker.mark(updatedAt);
      const stable = await activityTracker.waitForStable({ since: startedAt });
      const settledAt = performance.now();
      const performanceWindow = performanceTracker.measure(startedAt, settledAt);
      const stepSettledMs = settledAt - startedAt;
      const stepUpdateMs = updatedAt - startedAt;
      const stepActiveMs = Math.max(stepUpdateMs, stable.activeMs);

      diagnostics.activeMs += stepActiveMs;
      diagnostics.droppedFrames += performanceWindow.droppedFrames;
      diagnostics.frameCount += performanceWindow.frameCount;
      diagnostics.frameIntervalMedianMs += performanceWindow.frameIntervalMedianMs;
      diagnostics.frameIntervalP95Ms += performanceWindow.frameIntervalP95Ms;
      diagnostics.framesToActive += stable.framesToActive;
      diagnostics.framesToSettle += stable.framesToSettle;
      diagnostics.idleBudgetMs += performanceWindow.idleBudgetMs;
      diagnostics.idleCallbackCount += performanceWindow.idleCallbackCount;
      diagnostics.longAnimationFrameCount += performanceWindow.longAnimationFrameCount;
      diagnostics.longAnimationFrameMs += performanceWindow.longAnimationFrameMs;
      diagnostics.longTaskCount += performanceWindow.longTaskCount;
      diagnostics.longTaskMs += performanceWindow.longTaskMs;
      diagnostics.quietMs += Math.max(0, stepSettledMs - stepActiveMs);
      diagnostics.settleWaitMs += settledAt - updatedAt;
      diagnostics.settledMs += stepSettledMs;
      diagnostics.updateMs += stepUpdateMs;
    }

    const metrics = endTracking();
    const steps = Math.max(1, measuredSteps.length);

    return {
      ...metrics,
      ...mounted.collectExtraMetrics?.(),
      activeMs: diagnostics.activeMs,
      droppedFrames: diagnostics.droppedFrames,
      frameCount: diagnostics.frameCount,
      idleBudgetMs: diagnostics.idleBudgetMs,
      idleCallbackCount: diagnostics.idleCallbackCount,
      longAnimationFrameCount: diagnostics.longAnimationFrameCount,
      longAnimationFrameMs: diagnostics.longAnimationFrameMs,
      longTaskCount: diagnostics.longTaskCount,
      longTaskMs: diagnostics.longTaskMs,
      meanActiveMs: diagnostics.activeMs / steps,
      meanFrameIntervalMedianMs: diagnostics.frameIntervalMedianMs / steps,
      meanFrameIntervalP95Ms: diagnostics.frameIntervalP95Ms / steps,
      meanFramesToActive: diagnostics.framesToActive / steps,
      meanFramesToSettle: diagnostics.framesToSettle / steps,
      meanQuietMs: diagnostics.quietMs / steps,
      meanStepMs: diagnostics.settledMs / steps,
      meanSettleWaitMs: diagnostics.settleWaitMs / steps,
      meanSettledMs: diagnostics.settledMs / steps,
      meanUpdateMs: diagnostics.updateMs / steps,
      quietMs: diagnostics.quietMs,
      settleWaitMs: diagnostics.settleWaitMs,
      settledMs: diagnostics.settledMs,
      steps: measuredSteps.length,
      totalMs: diagnostics.settledMs,
      updateMs: diagnostics.updateMs,
    };
  } finally {
    performanceTracker.disconnect();
    activityTracker.disconnect();
    endTracking();
    mounted.app.unmount();
    mounted.container.remove();
  }
}

async function runBenchmark(
  scenario: PublicScenario,
  component: Component,
): Promise<BenchmarkSummary> {
  const runs: BenchmarkRun[] = [];
  let summary: BenchmarkSummary | null = null;

  for (let index = 0; index < benchmarkSamplingConfig.warmupRuns; index += 1) {
    await runScenarioOnce(scenario, component);
  }

  const measuredStartedAt = performance.now();

  for (let index = 0; index < benchmarkSamplingConfig.maxRuns; index += 1) {
    const run = await runScenarioOnce(scenario, component);
    runs.push(run);

    if (runs.length >= benchmarkSamplingConfig.minRuns) {
      const sampleWallMs = performance.now() - measuredStartedAt;
      summary = benchmarkSummary(runs, sampleWallMs);

      if (
        sampleWallMs >= benchmarkSamplingConfig.minScenarioMs ||
        sampleWallMs >= benchmarkSamplingConfig.maxScenarioMs
      ) {
        break;
      }
    }
  }

  return summary ?? benchmarkSummary(runs, performance.now() - measuredStartedAt);
}

type BenchmarkTargetInput = {
  component: Component;
  target: BenchmarkTarget;
};

type BenchmarkTargetState = BenchmarkTargetInput & {
  runs: BenchmarkRun[];
  sampleWallMs: number;
  summary: BenchmarkSummary | null;
};

function benchmarkSummary(runs: BenchmarkRun[], sampleWallMs: number): BenchmarkSummary {
  const summary = summarizeRuns(runs);
  summary.sampleTotalActiveMs = runs.reduce((total, item) => total + (item.activeMs ?? 0), 0);
  summary.sampleWallMs = sampleWallMs;

  return summary;
}

function summaryNumber(summary: BenchmarkSummary, key: string): number {
  const value = summary[key];

  return typeof value === "number" ? value : 0;
}

const compactCounterMedianKeys = new Set([
  "medianAddedNodes",
  "medianAttributeMutationRecords",
  "medianActiveMs",
  "medianBoundingRectReads",
  "medianCharacterDataMutationRecords",
  "medianChildListMutationRecords",
  "medianClientHeightReads",
  "medianClientRectEntries",
  "medianClientRectReads",
  "medianClientTopReads",
  "medianClientWidthReads",
  "medianHiddenAddedNodes",
  "medianHiddenChildListMutationRecords",
  "medianHiddenMutationRecords",
  "medianHiddenRemovedNodes",
  "medianMutationRecords",
  "medianOffsetHeightReads",
  "medianOffsetWidthReads",
  "medianRemovedNodes",
  "medianScrollWidthReads",
  "medianStyleReads",
]);

function runMetricKey(summaryKey: string): string {
  const name = summaryKey.slice("median".length);

  return `${name[0]?.toLowerCase() ?? ""}${name.slice(1)}`;
}

function isCompactExtraMetric(summaryKey: string): boolean {
  const metricKey = runMetricKey(summaryKey);

  return (
    metricKey === "componentInstances" ||
    metricKey.endsWith("Calls") ||
    metricKey.endsWith("Callbacks") ||
    metricKey.endsWith("Nodes") ||
    metricKey.endsWith("Records")
  );
}

function compactExtraMetrics(summary: BenchmarkSummary): Record<string, number> | undefined {
  const extra: Record<string, number> = {};

  for (const [key, value] of Object.entries(summary)) {
    if (
      !key.startsWith("median") ||
      compactCounterMedianKeys.has(key) ||
      typeof value !== "number" ||
      !isCompactExtraMetric(key)
    ) {
      continue;
    }

    extra[runMetricKey(key)] = value;
  }

  return Object.keys(extra).length > 0 ? extra : undefined;
}

function compactCounters(summary: BenchmarkSummary): CompactCounterSummary {
  return {
    addedNodes: summaryNumber(summary, "medianAddedNodes"),
    attributeMutationRecords: summaryNumber(summary, "medianAttributeMutationRecords"),
    activeMs: summaryNumber(summary, "medianActiveMs"),
    boundingRectReads: summaryNumber(summary, "medianBoundingRectReads"),
    characterDataMutationRecords: summaryNumber(summary, "medianCharacterDataMutationRecords"),
    childListMutationRecords: summaryNumber(summary, "medianChildListMutationRecords"),
    clientHeightReads: summaryNumber(summary, "medianClientHeightReads"),
    clientRectEntries: summaryNumber(summary, "medianClientRectEntries"),
    clientRectReads: summaryNumber(summary, "medianClientRectReads"),
    clientTopReads: summaryNumber(summary, "medianClientTopReads"),
    clientWidthReads: summaryNumber(summary, "medianClientWidthReads"),
    hiddenAddedNodes: summaryNumber(summary, "medianHiddenAddedNodes"),
    hiddenChildListMutationRecords: summaryNumber(summary, "medianHiddenChildListMutationRecords"),
    hiddenMutationRecords: summaryNumber(summary, "medianHiddenMutationRecords"),
    hiddenRemovedNodes: summaryNumber(summary, "medianHiddenRemovedNodes"),
    mutationRecords: summaryNumber(summary, "medianMutationRecords"),
    offsetHeightReads: summaryNumber(summary, "medianOffsetHeightReads"),
    offsetWidthReads: summaryNumber(summary, "medianOffsetWidthReads"),
    removedNodes: summaryNumber(summary, "medianRemovedNodes"),
    scrollWidthReads: summaryNumber(summary, "medianScrollWidthReads"),
    styleReads: summaryNumber(summary, "medianStyleReads"),
  };
}

function measuredWidthAssignments(scenario: PublicScenario): number[] {
  const initialWidth = scenario.widths[0];
  if (initialWidth === undefined) {
    return [];
  }

  const assignments = [initialWidth];
  const measuredSteps = scenario.widthBursts ?? scenario.widths.slice(1);

  for (const step of measuredSteps) {
    if (typeof step === "number") {
      assignments.push(step);
      continue;
    }

    assignments.push(...step);
  }

  return assignments;
}

function widthProfileForScenario(scenario: PublicScenario): WidthProfile {
  const assignments = measuredWidthAssignments(scenario);
  const seen = new Set<number>();
  let repeatedWidthAssignments = 0;
  let repeatedTransitions = 0;
  let largeDeltaTransitions = 0;
  let maxDelta = 0;

  for (let index = 0; index < assignments.length; index += 1) {
    const width = assignments[index]!;
    const seenBefore = seen.has(width);

    if (seenBefore) {
      repeatedWidthAssignments += 1;
    }

    const previous = assignments[index - 1];
    if (previous === undefined) {
      seen.add(width);
      continue;
    }

    if (seenBefore) {
      repeatedTransitions += 1;
    }

    const delta = Math.abs(width - previous);
    if (delta > largeWidthDeltaThreshold) {
      largeDeltaTransitions += 1;
    }
    maxDelta = Math.max(maxDelta, delta);
    seen.add(width);
  }

  return {
    largeDeltaThreshold: largeWidthDeltaThreshold,
    largeDeltaTransitions,
    maxDelta,
    repeatedTransitions,
    repeatedWidthAssignments,
    stepCount: scenario.widthBursts?.length ?? Math.max(0, scenario.widths.length - 1),
    transitionCount: Math.max(0, assignments.length - 1),
    uniqueWidthCount: seen.size,
    widthAssignmentCount: assignments.length,
  };
}

function compactScenarioResult(result: ScenarioResult): CompactScenarioResult {
  if (result.status === "unsupported") {
    return {
      component: result.component,
      group: result.group,
      reason: result.reason,
      scenario: result.scenario,
      status: result.status,
      widthProfile: result.widthProfile,
    };
  }

  const extra = compactExtraMetrics(result.summary);

  return {
    component: result.component,
    group: result.group,
    scenario: result.scenario,
    status: result.status,
    summary: {
      ...compactCounters(result.summary),
      ...(extra ? { extra } : {}),
      rmeActiveMs: summaryNumber(result.summary, "sampleRme95ActiveMs"),
      runs: result.summary.runs.length,
    },
    widthProfile: result.widthProfile,
  };
}

function addCompactCounters(
  left: CompactCounterSummary,
  right: CompactCounterSummary,
): CompactCounterSummary {
  return {
    addedNodes: left.addedNodes + right.addedNodes,
    attributeMutationRecords: left.attributeMutationRecords + right.attributeMutationRecords,
    activeMs: left.activeMs + right.activeMs,
    boundingRectReads: left.boundingRectReads + right.boundingRectReads,
    characterDataMutationRecords:
      left.characterDataMutationRecords + right.characterDataMutationRecords,
    childListMutationRecords: left.childListMutationRecords + right.childListMutationRecords,
    clientHeightReads: left.clientHeightReads + right.clientHeightReads,
    clientRectEntries: left.clientRectEntries + right.clientRectEntries,
    clientRectReads: left.clientRectReads + right.clientRectReads,
    clientTopReads: left.clientTopReads + right.clientTopReads,
    clientWidthReads: left.clientWidthReads + right.clientWidthReads,
    hiddenAddedNodes: left.hiddenAddedNodes + right.hiddenAddedNodes,
    hiddenChildListMutationRecords:
      left.hiddenChildListMutationRecords + right.hiddenChildListMutationRecords,
    hiddenMutationRecords: left.hiddenMutationRecords + right.hiddenMutationRecords,
    hiddenRemovedNodes: left.hiddenRemovedNodes + right.hiddenRemovedNodes,
    mutationRecords: left.mutationRecords + right.mutationRecords,
    offsetHeightReads: left.offsetHeightReads + right.offsetHeightReads,
    offsetWidthReads: left.offsetWidthReads + right.offsetWidthReads,
    removedNodes: left.removedNodes + right.removedNodes,
    scrollWidthReads: left.scrollWidthReads + right.scrollWidthReads,
    styleReads: left.styleReads + right.styleReads,
  };
}

function emptyCompactCounters(): CompactCounterSummary {
  return {
    addedNodes: 0,
    attributeMutationRecords: 0,
    activeMs: 0,
    boundingRectReads: 0,
    characterDataMutationRecords: 0,
    childListMutationRecords: 0,
    clientHeightReads: 0,
    clientRectEntries: 0,
    clientRectReads: 0,
    clientTopReads: 0,
    clientWidthReads: 0,
    hiddenAddedNodes: 0,
    hiddenChildListMutationRecords: 0,
    hiddenMutationRecords: 0,
    hiddenRemovedNodes: 0,
    mutationRecords: 0,
    offsetHeightReads: 0,
    offsetWidthReads: 0,
    removedNodes: 0,
    scrollWidthReads: 0,
    styleReads: 0,
  };
}

function addCompactExtraTotals(
  totals: Record<string, number>,
  extra: Record<string, number> | undefined,
): Record<string, number> {
  if (!extra) {
    return totals;
  }

  for (const [key, value] of Object.entries(extra)) {
    totals[key] = (totals[key] ?? 0) + value;
  }

  return totals;
}

function compactTargetReport(target: BenchmarkTarget, results: ScenarioResult[]) {
  const scenarios = results.map(compactScenarioResult);
  const totals = scenarios.reduce(
    (total, result) => (result.summary ? addCompactCounters(total, result.summary) : total),
    emptyCompactCounters(),
  );
  const extraTotals = scenarios.reduce(
    (total, result) => addCompactExtraTotals(total, result.summary?.extra),
    {} as Record<string, number>,
  );

  return {
    counterTracking: __VUE_CLAMP_BENCH_COUNTERS__,
    ...(Object.keys(extraTotals).length > 0 ? { extraTotals } : {}),
    scenarios,
    target: {
      specifier: target.specifier,
      version: target.version,
    },
    totals,
  };
}

async function runTargetBenchmarks(
  scenario: PublicScenario,
  inputs: readonly BenchmarkTargetInput[],
): Promise<{ summary: BenchmarkSummary; target: BenchmarkTarget }[]> {
  if (inputs.length === 1) {
    const input = inputs[0]!;
    return [
      {
        summary: await runBenchmark(scenario, input.component),
        target: input.target,
      },
    ];
  }

  for (let index = 0; index < benchmarkSamplingConfig.warmupRuns; index += 1) {
    for (const input of inputs) {
      await runScenarioOnce(scenario, input.component);
    }
  }

  const states: BenchmarkTargetState[] = inputs.map((input) => ({
    ...input,
    runs: [],
    sampleWallMs: 0,
    summary: null,
  }));

  while (true) {
    for (const state of states) {
      const startedAt = performance.now();
      const run = await runScenarioOnce(scenario, state.component);
      state.sampleWallMs += performance.now() - startedAt;
      state.runs.push(run);
    }

    for (const state of states) {
      state.summary = benchmarkSummary(state.runs, state.sampleWallMs);
    }

    const runCount = states[0]?.runs.length ?? 0;
    if (runCount < benchmarkSamplingConfig.minRuns) {
      continue;
    }

    if (
      states.every((state) => state.sampleWallMs >= benchmarkSamplingConfig.minScenarioMs) ||
      states.some((state) => state.sampleWallMs >= benchmarkSamplingConfig.maxScenarioMs) ||
      runCount >= benchmarkSamplingConfig.maxRuns
    ) {
      break;
    }
  }

  return states.map((state) => ({
    summary: state.summary ?? benchmarkSummary(state.runs, state.sampleWallMs),
    target: state.target,
  }));
}

function formatMetric(value: unknown, digits = 1): string {
  return typeof value === "number" ? value.toFixed(digits) : "N/A";
}

function logWidthProfileFields(profile: WidthProfile): string[] {
  return [
    `widths=${profile.widthAssignmentCount}`,
    `uniqueWidths=${profile.uniqueWidthCount}`,
    `steps=${profile.stepCount}`,
    `transitions=${profile.transitionCount}`,
    `repeatedAssignments=${profile.repeatedWidthAssignments}`,
    `repeatedTransitions=${profile.repeatedTransitions}`,
    `largeDeltas=${profile.largeDeltaTransitions}`,
    `maxDelta=${profile.maxDelta}`,
  ];
}

function logScenarioResult(target: BenchmarkTarget, result: ScenarioResult): void {
  if (result.status === "unsupported") {
    console.error(
      [
        "BENCH_SCENARIO",
        `version=${target.version}`,
        `target=${JSON.stringify(target.specifier)}`,
        `component=${result.component}`,
        `scenario=${result.scenario}`,
        "status=unsupported",
        `reason=${JSON.stringify(result.reason)}`,
        ...logWidthProfileFields(result.widthProfile),
      ].join(" "),
    );
    return;
  }

  const summary = result.summary;
  const extra = compactExtraMetrics(summary);
  console.error(
    [
      "BENCH_SCENARIO",
      `version=${target.version}`,
      `target=${JSON.stringify(target.specifier)}`,
      `component=${result.component}`,
      `scenario=${result.scenario}`,
      "status=ok",
      ...logWidthProfileFields(result.widthProfile),
      `samples=${summary.sampleCount}`,
      `wallMs=${formatMetric(summary.sampleWallMs)}`,
      `sampleActiveMs=${formatMetric(summary.sampleTotalActiveMs)}`,
      `medianActiveMs=${formatMetric(summary.medianActiveMs)}`,
      `meanActiveMs=${formatMetric(summary.sampleMeanActiveMs)}`,
      `stdDevActiveMs=${formatMetric(summary.sampleStdDevActiveMs)}`,
      `cvActive=${formatMetric(summary.sampleCvActiveMs)}%`,
      `rmeActive=${formatMetric(summary.sampleRme95ActiveMs)}%`,
      `bboxReads=${formatMetric(summary.medianBoundingRectReads)}`,
      `clientRectReads=${formatMetric(summary.medianClientRectReads)}`,
      `clientRectEntries=${formatMetric(summary.medianClientRectEntries)}`,
      `mutationRecords=${formatMetric(summary.medianMutationRecords)}`,
      `hiddenMutations=${formatMetric(summary.medianHiddenMutationRecords)}`,
      `childListRecords=${formatMetric(summary.medianChildListMutationRecords)}`,
      `hiddenChildList=${formatMetric(summary.medianHiddenChildListMutationRecords)}`,
      `characterDataRecords=${formatMetric(summary.medianCharacterDataMutationRecords)}`,
      `attributeRecords=${formatMetric(summary.medianAttributeMutationRecords)}`,
      `addedNodes=${formatMetric(summary.medianAddedNodes)}`,
      `hiddenAdded=${formatMetric(summary.medianHiddenAddedNodes)}`,
      `removedNodes=${formatMetric(summary.medianRemovedNodes)}`,
      `hiddenRemoved=${formatMetric(summary.medianHiddenRemovedNodes)}`,
      `scrollWidthReads=${formatMetric(summary.medianScrollWidthReads)}`,
      `styleReads=${formatMetric(summary.medianStyleReads)}`,
      ...(extra ? [`extra=${JSON.stringify(extra)}`] : []),
    ].join(" "),
  );
}

beforeAll(async () => {
  installBenchmarkSpies({ counters: __VUE_CLAMP_BENCH_COUNTERS__ });
});

afterEach(() => {
  resetBenchmarkDom();
});

afterAll(() => {
  restoreBenchmarkSpies();
});

describe("vue-clamp package benchmark", () => {
  it("reports public component workloads", async () => {
    const resultsByTarget = new Map<BenchmarkTarget, ScenarioResult[]>(
      targets.map((target) => [target, []]),
    );

    for (const scenario of selectedScenarios()) {
      const runnable: BenchmarkTargetInput[] = [];
      const widthProfile = widthProfileForScenario(scenario);

      for (const target of targets) {
        const unsupportedReason = unsupportedScenarioReason(scenario, target);
        const targetResults = resultsByTarget.get(target)!;

        if (unsupportedReason) {
          const result: ScenarioResult = {
            component: scenario.component,
            group: scenario.group,
            reason: unsupportedReason,
            scenario: scenario.name,
            status: "unsupported",
            widthProfile,
          };
          targetResults.push(result);
          logScenarioResult(target, result);
          continue;
        }

        const component = target.module[scenario.component];

        if (!component) {
          const result: ScenarioResult = {
            component: scenario.component,
            group: scenario.group,
            reason: `${scenario.component} is not exported by this target.`,
            scenario: scenario.name,
            status: "unsupported",
            widthProfile,
          };
          targetResults.push(result);
          logScenarioResult(target, result);
          continue;
        }

        runnable.push({
          component,
          target,
        });
      }

      const summaries = await runTargetBenchmarks(scenario, runnable);

      for (const { summary, target } of summaries) {
        const result: ScenarioResult = {
          component: scenario.component,
          group: scenario.group,
          scenario: scenario.name,
          status: "ok",
          summary,
          widthProfile,
        };
        resultsByTarget.get(target)!.push(result);
        logScenarioResult(target, result);
      }
    }

    const reports = targets.map((target) => ({
      environment: {
        browser: "chromium",
        counterTracking: __VUE_CLAMP_BENCH_COUNTERS__,
        sampling: benchmarkSamplingConfig,
        scenarioFilter: __VUE_CLAMP_BENCH_SCENARIOS__,
        viewport: {
          height: 900,
          width: 1280,
        },
        vueVersion,
      },
      schemaVersion: 3,
      scenarios: resultsByTarget.get(target)!,
      target: {
        entry: target.entry,
        specifier: target.specifier,
        version: target.version,
      },
    }));
    const report =
      reports.length === 1
        ? reports[0]
        : {
            reports,
            schemaVersion: 4,
          };
    const compactReports = targets.map((target) =>
      compactTargetReport(target, resultsByTarget.get(target)!),
    );
    const compactReport =
      compactReports.length === 1
        ? {
            ...compactReports[0],
            schemaVersion: 2,
          }
        : {
            reports: compactReports,
            schemaVersion: 2,
          };

    console.error(`PACKAGE_MATRIX_SUMMARY ${JSON.stringify(compactReport)}`);
    console.error(`PACKAGE_MATRIX_BENCHMARK ${JSON.stringify(report)}`);

    expect(
      [...resultsByTarget.values()].some((results) =>
        results.some((result) => result.status === "ok"),
      ),
    ).toBe(true);
    for (const results of resultsByTarget.values()) {
      for (const result of results) {
        if (result.status === "ok") {
          expect(result.summary.runs.length).toBeGreaterThanOrEqual(
            benchmarkSamplingConfig.minRuns,
          );
          expect(result.summary.runs.length).toBeLessThanOrEqual(benchmarkSamplingConfig.maxRuns);
        }
      }
    }
  });
});
