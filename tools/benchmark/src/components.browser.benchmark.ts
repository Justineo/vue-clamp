import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, ref, version as vueVersion } from "vue";
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
  component: ComponentName;
  group: "inline" | "line" | "rich" | "wrap";
  minVersion?: string;
  mount: (component: Component, initialWidth: number) => Promise<MountedScenario>;
  name: string;
  unsupportedReason?: string;
  widths: readonly number[];
  widthBursts?: readonly (readonly number[])[];
};

type ScenarioResult =
  | {
      component: ComponentName;
      group: PublicScenario["group"];
      scenario: string;
      status: "ok";
      summary: BenchmarkSummary;
    }
  | {
      component: ComponentName;
      group: PublicScenario["group"];
      reason: string;
      scenario: string;
      status: "unsupported";
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
const inlineText =
  "/workspace/vue-clamp/packages/components/long-generated-file-name.browser.benchmark.ts";
const inlineSentence =
  "Customer incident summaries should keep complete words visible while the available inline space changes.";
const richHtml =
  '<strong>Incident #4721</strong>: API latency moved after <code>release/2.4.0</code>. Owners are <span style="display:inline-block">Platform</span> and <a href="/status">Support</a>.';
const articleHtml =
  '<strong>Design systems</strong> need <a href="/guides"><em>predictable</em> truncation</a> when inline badges, <code>code</code>, and <span style="white-space:nowrap">non-breaking phrases</span> share the same paragraph.';
const richWordHtml =
  "<strong>International response</strong> keeps regional mitigations, customer communications, and ownership notes readable without cutting important words in half.";
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
const inlineFeatureWidths = repeatedWidths([340, 110, 320, 140, 280, 100, 340], 3);
const richFeatureWidths = repeatedWidths([400, 160, 380, 180, 340, 140, 400], 3);
const lineBatchSize = 16;
const inlineBatchSize = 16;
const richBatchSize = 16;

let vueClamp: VueClampModule = {};

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
      minRuns: 3,
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

function unsupportedScenarioReason(scenario: PublicScenario): string | null {
  if (
    scenario.minVersion &&
    compareVersions(__VUE_CLAMP_BENCH_TARGET__.version, scenario.minVersion) < 0
  ) {
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

function blockStyle(width: number): string {
  return [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia,serif",
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
  ellipsis?: string;
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
              style: blockStyle(width.value),
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
        h(
          "div",
          { style: batchHostStyle() },
          instances.map((index) => {
            const props: Record<string, unknown> = {
              html: richHtmlVariant(options.html ?? richHtml, index),
              key: index,
              maxLines: options.maxLines ?? 2,
              style: blockStyle(width.value),
            };
            const slots: Record<string, () => VNodeChild> = {};

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
      minVersion: "1.3.0",
      mount: lineClampBatch({ boundary: "word", maxLines: 3, text: wordBoundaryText }),
      name: "line-word-copy-batch-jumps",
      unsupportedReason: 'LineClamp boundary="word" was added in vue-clamp 1.3.0.',
      widths: lineFeatureWidths,
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
      mount: richLineClampBatch({ maxHeight: "44px" }),
      name: "rich-height-card-batch-jumps",
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

    for (const step of measuredSteps) {
      const startedAt = performance.now();
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
      summary = summarizeRuns(runs);
      summary.sampleTotalActiveMs = runs.reduce((total, item) => total + (item.activeMs ?? 0), 0);
      summary.sampleWallMs = performance.now() - measuredStartedAt;

      if (
        summary.sampleWallMs >= benchmarkSamplingConfig.minScenarioMs ||
        summary.sampleWallMs >= benchmarkSamplingConfig.maxScenarioMs
      ) {
        break;
      }
    }
  }

  const finalSummary = summary ?? summarizeRuns(runs);
  finalSummary.sampleTotalActiveMs = runs.reduce((total, item) => total + (item.activeMs ?? 0), 0);
  finalSummary.sampleWallMs = performance.now() - measuredStartedAt;

  return finalSummary;
}

function formatMetric(value: unknown, digits = 1): string {
  return typeof value === "number" ? value.toFixed(digits) : "N/A";
}

function logScenarioResult(result: ScenarioResult): void {
  if (result.status === "unsupported") {
    console.error(
      [
        "BENCH_SCENARIO",
        `version=${__VUE_CLAMP_BENCH_TARGET__.version}`,
        `component=${result.component}`,
        `scenario=${result.scenario}`,
        "status=unsupported",
        `reason=${JSON.stringify(result.reason)}`,
      ].join(" "),
    );
    return;
  }

  const summary = result.summary;
  console.error(
    [
      "BENCH_SCENARIO",
      `version=${__VUE_CLAMP_BENCH_TARGET__.version}`,
      `component=${result.component}`,
      `scenario=${result.scenario}`,
      "status=ok",
      `samples=${summary.sampleCount}`,
      `wallMs=${formatMetric(summary.sampleWallMs)}`,
      `sampleActiveMs=${formatMetric(summary.sampleTotalActiveMs)}`,
      `medianActiveMs=${formatMetric(summary.medianActiveMs)}`,
      `meanActiveMs=${formatMetric(summary.sampleMeanActiveMs)}`,
      `stdDevActiveMs=${formatMetric(summary.sampleStdDevActiveMs)}`,
      `cvActive=${formatMetric(summary.sampleCvActiveMs)}%`,
      `rmeActive=${formatMetric(summary.sampleRme95ActiveMs)}%`,
    ].join(" "),
  );
}

beforeAll(async () => {
  installBenchmarkSpies();
  vueClamp = (await import("vue-clamp")) as VueClampModule;
});

afterEach(() => {
  resetBenchmarkDom();
});

afterAll(() => {
  restoreBenchmarkSpies();
});

describe("vue-clamp package benchmark", () => {
  it("reports public component workloads", async () => {
    const results: ScenarioResult[] = [];

    for (const scenario of scenarios()) {
      const unsupportedReason = unsupportedScenarioReason(scenario);
      if (unsupportedReason) {
        const result: ScenarioResult = {
          component: scenario.component,
          group: scenario.group,
          reason: unsupportedReason,
          scenario: scenario.name,
          status: "unsupported",
        };
        results.push(result);
        logScenarioResult(result);
        continue;
      }

      const component = vueClamp[scenario.component];

      if (!component) {
        const result: ScenarioResult = {
          component: scenario.component,
          group: scenario.group,
          reason: `${scenario.component} is not exported by this target.`,
          scenario: scenario.name,
          status: "unsupported",
        };
        results.push(result);
        logScenarioResult(result);
        continue;
      }

      const result: ScenarioResult = {
        component: scenario.component,
        group: scenario.group,
        scenario: scenario.name,
        status: "ok",
        summary: await runBenchmark(scenario, component),
      };
      results.push(result);
      logScenarioResult(result);
    }

    const report = {
      environment: {
        browser: "chromium",
        sampling: benchmarkSamplingConfig,
        viewport: {
          height: 900,
          width: 1280,
        },
        vueVersion,
      },
      schemaVersion: 3,
      scenarios: results,
      target: __VUE_CLAMP_BENCH_TARGET__,
    };

    console.error(`PACKAGE_MATRIX_BENCHMARK ${JSON.stringify(report)}`);

    expect(results.some((result) => result.status === "ok")).toBe(true);
    for (const result of results) {
      if (result.status === "ok") {
        expect(result.summary.runs.length).toBeGreaterThanOrEqual(benchmarkSamplingConfig.minRuns);
        expect(result.summary.runs.length).toBeLessThanOrEqual(benchmarkSamplingConfig.maxRuns);
      }
    }
  });
});
